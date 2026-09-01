/* GeoPuzzle – Google Maps コンポーネント
 *
 * 特徴:
 *   - Vector map + Map ID をデフォルトで使用
 *   - MapRestriction により地図の表示範囲を日本列島に制限（タイルDLを削減して高速化）
 *   - QZ1 / WebSocket / navigator.geolocation など「位置情報のソース」に依存しない
 *   - 位置は必ず外部から setUserPosition / setTargets で注入する設計
 *   - APIキーやMap IDは EnvLoader 経由で取得。ハードコード一切なし
 */

(function (global) {
  'use strict';

  var LOAD_STATE = { IDLE: 'idle', LOADING: 'loading', READY: 'ready', ERROR: 'error' };

  /** 日本列島の lat/lng bounds（北端: 択捉島南端付近 / 南端: 与那国島 / 東端: 南鳥島 / 西端: 与那国島西） */
  var JAPAN_BOUNDS = {
    north: 45.6,
    south: 23.5,
    east: 154.0,
    west: 122.0,
  };

  var loaderState = LOAD_STATE.IDLE;
  var loaderDeferred = null;
  var loaderError = null;

  function createDeferred() {
    var resolve, reject;
    var p = new Promise(function (res, rej) { resolve = res; reject = rej; });
    return { promise: p, resolve: resolve, reject: reject };
  }

  /** Maps JS API を1回だけロード */
  function loadGoogleMaps() {
    if (loaderState === LOAD_STATE.READY) {
      return Promise.resolve(global.google && global.google.maps);
    }
    if (loaderState === LOAD_STATE.ERROR) {
      return Promise.reject(loaderError || new Error('Google Maps failed to load'));
    }
    if (loaderState === LOAD_STATE.LOADING) {
      return loaderDeferred.promise;
    }

    loaderState = LOAD_STATE.LOADING;
    loaderDeferred = createDeferred();

    if (!global.EnvLoader || !global.EnvLoader.isGoogleMapsAvailable()) {
      var err = new Error('Google Maps env is missing: ' +
        JSON.stringify(global.EnvLoader ? global.EnvLoader.getMissingKeys() : ['EnvLoader missing']));
      loaderError = err;
      loaderState = LOAD_STATE.ERROR;
      loaderDeferred.reject(err);
      return loaderDeferred.promise;
    }

    var apiKey = global.EnvLoader.get('GOOGLE_MAPS_API_KEY');
    var mapId = global.EnvLoader.get('GOOGLE_MAPS_MAP_ID');
    var cbName = '__geoMapsCb_' + Math.random().toString(36).slice(2, 9);

    global[cbName] = function () {
      try { delete global[cbName]; } catch (_) { global[cbName] = undefined; }
      if (global.google && global.google.maps) {
        loaderState = LOAD_STATE.READY;
        loaderDeferred.resolve(global.google.maps);
      } else {
        var e2 = new Error('Google Maps loaded but google.maps not found');
        loaderError = e2;
        loaderState = LOAD_STATE.ERROR;
        loaderDeferred.reject(e2);
      }
    };

    var s = document.createElement('script');
    s.async = true;
    s.defer = true;
    s.onerror = function () {
      var e3 = new Error('Failed to load Google Maps script');
      loaderError = e3;
      loaderState = LOAD_STATE.ERROR;
      loaderDeferred.reject(e3);
    };
    var params = [
      'key=' + encodeURIComponent(apiKey),
      'map_ids=' + encodeURIComponent(mapId),
      'libraries=maps',
      'language=ja',
      'region=JP',
      'callback=' + cbName,
    ];
    s.src = 'https://maps.googleapis.com/maps/api/js?' + params.join('&');
    document.head.appendChild(s);

    return loaderDeferred.promise;
  }

  function buildMapOptions(maps, center, zoom, mapId) {
    return {
      center: center,
      zoom: zoom,
      mapId: mapId,
      restriction: {
        latLngBounds: {
          north: JAPAN_BOUNDS.north,
          south: JAPAN_BOUNDS.south,
          east: JAPAN_BOUNDS.east,
          west: JAPAN_BOUNDS.west,
        },
        strictBounds: true,
      },
      mapTypeControl: false,
      fullscreenControl: false,
      streetViewControl: false,
      zoomControl: true,
      zoomControlOptions: { position: 10 /* RIGHT_TOP */, style: 0 /* DEFAULT */ },
      clickableIcons: false,
      isFractionalZoomEnabled: true,
      gestureHandling: 'greedy',
      disableDefaultUI: false,
      scaleControl: true,
      rotateControl: false,
    };
  }

  function createCircleStyle(maps, center, radius, color, fillOpacity, strokeOpacity) {
    return {
      strokeColor: color,
      strokeOpacity: typeof strokeOpacity === 'number' ? strokeOpacity : 0.8,
      strokeWeight: 2,
      fillColor: color,
      fillOpacity: typeof fillOpacity === 'number' ? fillOpacity : 0.15,
      map: null,
      center: center,
      radius: radius,
    };
  }

  /** 環境変数が足りない or APIが読み込めないときの代替表示 */
  function renderFallback(container, err) {
    container.innerHTML = '';
    var wrap = document.createElement('div');
    wrap.style.cssText = [
      'width:100%', 'height:100%',
      'display:flex', 'flex-direction:column',
      'align-items:center', 'justify-content:center',
      'padding:24px', 'text-align:center',
      'background:var(--card-map, #C9D9CF)',
      'color:var(--text-secondary, #6B7C88)',
      'border-radius:var(--radius-xl, 20px)',
      'font-family:Noto Sans JP, sans-serif',
    ].join(';');
    var title = document.createElement('div');
    title.style.cssText = 'font-size:16px;font-weight:700;color:var(--text-primary);margin-bottom:8px;';
    title.textContent = 'Google Maps を読み込めません';
    var body = document.createElement('div');
    body.style.cssText = 'font-size:12px;line-height:1.6;max-width:460px;white-space:pre-wrap;';
    var missing = global.EnvLoader ? global.EnvLoader.getMissingKeys() : [];
    var text = '環境変数の設定が不足している可能性があります。';
    if (missing && missing.length) text += '\n不足: ' + missing.join(', ');
    if (err && err.message) text += '\nエラー: ' + err.message;
    body.textContent = text;
    wrap.appendChild(title);
    wrap.appendChild(body);
    container.appendChild(wrap);
  }

  /**
   * GeoMap インスタンスを作成して container にマウントする。
   * @param {HTMLElement|string} el
   * @param {{
   *   center?: {lat:number, lng:number},
   *   zoom?: number,
   * }} options
   * @returns {Promise<GeoMapInstance>}
   */
  function mount(el, options) {
    var container = typeof el === 'string' ? document.querySelector(el) : el;
    if (!container) return Promise.reject(new Error('GeoMap: container not found: ' + el));
    if (container._geoMap) return Promise.resolve(container._geoMap);

    var mapId = global.EnvLoader.get('GOOGLE_MAPS_MAP_ID');
    var opts = {
      center: options && options.center ? options.center : { lat: 36.7823, lng: 137.1105 },
      zoom: options && typeof options.zoom === 'number' ? options.zoom : 17,
    };

    return loadGoogleMaps().then(function (maps) {
      if (!maps) throw new Error('google.maps not available');
      var gMap = new maps.Map(container, buildMapOptions(maps, opts.center, opts.zoom, mapId));
      var instance = createInstance(maps, gMap, container);
      container._geoMap = instance;
      return instance;
    }).catch(function (err) {
      renderFallback(container, err);
      throw err;
    });
  }

  /** GeoMap の公開APIを持つインスタンスを作成 */
  function createInstance(maps, gMap, container) {
    var state = {
      userMarker: null,
      userAccuracyCircle: null,
      targets: Object.create(null),
      centerLocked: true,
    };

    function setCenterOnUser() {
      if (state.userMarker) gMap.panTo(state.userMarker.getPosition());
    }

    function setUserPosition(pos) {
      if (!pos || typeof pos.lat !== 'number' || typeof pos.lng !== 'number') return;
      var latLng = new maps.LatLng(pos.lat, pos.lng);
      var isHighAccuracy = pos.provider === 'qzss';

      if (!state.userMarker) {
        var icon = {
          path: maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: isHighAccuracy ? '#E05C35' : (pos.provider === 'simulated' ? '#607D8B' : '#2196F3'),
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 2.5,
          rotation: typeof pos.bearing === 'number' ? pos.bearing : 0,
        };
        state.userMarker = new maps.Marker({
          position: latLng,
          map: gMap,
          zIndex: 120,
          icon: icon,
          title: pos.title || '現在地',
        });
      } else {
        state.userMarker.setPosition(latLng);
        var ic = state.userMarker.getIcon();
        if (ic) {
          ic.fillColor = isHighAccuracy ? '#E05C35' : (pos.provider === 'simulated' ? '#607D8B' : '#2196F3');
          if (typeof pos.bearing === 'number') ic.rotation = pos.bearing;
          state.userMarker.setIcon(ic);
        }
      }

      var accuracy = typeof pos.accuracy === 'number' ? pos.accuracy : 5;
      if (!state.userAccuracyCircle) {
        state.userAccuracyCircle = new maps.Circle(createCircleStyle(
          maps, latLng, accuracy,
          isHighAccuracy ? '#E05C35' : (pos.provider === 'simulated' ? '#607D8B' : '#2196F3'),
          0.18, 0.7
        ));
        state.userAccuracyCircle.setMap(gMap);
      } else {
        state.userAccuracyCircle.setCenter(latLng);
        state.userAccuracyCircle.setRadius(accuracy);
      }

      if (state.centerLocked) gMap.panTo(latLng);
    }

    function setTargets(targets) {
      var ids = Object.create(null);
      var list = Array.isArray(targets) ? targets : [];
      list.forEach(function (t) {
        if (!t || !t.id || !t.position) return;
        ids[t.id] = true;
        upsertTarget(t);
      });
      Object.keys(state.targets).forEach(function (id) {
        if (!ids[id]) removeTarget(id);
      });
    }

    function upsertTarget(t) {
      var entry = state.targets[t.id];
      var pos = new maps.LatLng(t.position.lat, t.position.lng);
      var color = t.color || '#E05C35';
      var radius = typeof t.radius === 'number' ? t.radius : 0.5;
      var fillOp = typeof t.fillOpacity === 'number' ? t.fillOpacity : 0.12;

      if (!entry) {
        var icon = {
          path: maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 2,
        };
        var marker = new maps.Marker({
          position: pos,
          map: gMap,
          icon: icon,
          zIndex: 100,
          title: t.title || t.id,
        });
        var circle = new maps.Circle(createCircleStyle(maps, pos, radius, color, fillOp, 0.9));
        circle.setMap(gMap);
        state.targets[t.id] = { marker: marker, circle: circle };
      } else {
        entry.marker.setPosition(pos);
        entry.marker.setTitle(t.title || t.id);
        entry.circle.setCenter(pos);
        entry.circle.setRadius(radius);
      }
    }

    function removeTarget(id) {
      var entry = state.targets[id];
      if (!entry) return;
      if (entry.marker) entry.marker.setMap(null);
      if (entry.circle) entry.circle.setMap(null);
      delete state.targets[id];
    }

    function setCenterLocked(locked) {
      state.centerLocked = !!locked;
      if (state.centerLocked) setCenterOnUser();
    }

    function panTo(pos) {
      if (!pos || typeof pos.lat !== 'number') return;
      gMap.panTo(new maps.LatLng(pos.lat, pos.lng));
    }

    function getNativeMap() { return gMap; }

    function destroy() {
      Object.keys(state.targets).forEach(removeTarget);
      if (state.userMarker) state.userMarker.setMap(null);
      if (state.userAccuracyCircle) state.userAccuracyCircle.setMap(null);
      state.userMarker = null;
      state.userAccuracyCircle = null;
      delete container._geoMap;
    }

    return {
      mount: function () { return mount(container); },
      setUserPosition: setUserPosition,
      setTargets: setTargets,
      setCenterLocked: setCenterLocked,
      panTo: panTo,
      getNativeMap: getNativeMap,
      destroy: destroy,
    };
  }

  global.GeoMap = {
    mount: mount,
    loadGoogleMaps: loadGoogleMaps,
    state: function () { return loaderState; },
    JAPAN_BOUNDS: JAPAN_BOUNDS,
  };
})(window);
