/* GeoPuzzle - MapLibre + PMTiles map component */
(function (global) {
  'use strict';

  var JAPAN_BOUNDS = [[122.0, 23.5], [154.0, 45.6]];
  var GSI_FALLBACK_STYLE = {
    version: 8,
    sources: {
      gsi: {
        type: 'raster',
        tiles: ['https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '地図データ © 国土地理院',
      },
    },
    layers: [{ id: 'gsi', type: 'raster', source: 'gsi' }],
  };

  function markerElement(color, size) {
    var element = document.createElement('div');
    element.style.cssText = 'width:' + size + 'px;height:' + size + 'px;border-radius:50%;background:' + color + ';border:2.5px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.3);';
    return element;
  }

  function renderFallback(container, error) {
    container.innerHTML = '';
    var wrap = document.createElement('div');
    wrap.style.cssText = 'width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;background:var(--card-map, #C9D9CF);color:var(--text-secondary, #6B7C88);border-radius:var(--radius-xl, 20px);font-family:Noto Sans JP, sans-serif;';
    var title = document.createElement('div');
    title.style.cssText = 'font-size:16px;font-weight:700;color:var(--text-primary);margin-bottom:8px;';
    title.textContent = '地図データを読み込めません';
    var body = document.createElement('div');
    body.style.cssText = 'font-size:12px;line-height:1.6;max-width:460px;white-space:pre-wrap;';
    body.textContent = 'public/maps/map.pmtiles と map.json を配置してください。\nエラー: ' + (error && error.message ? error.message : error);
    wrap.appendChild(title);
    wrap.appendChild(body);
    container.appendChild(wrap);
  }

  function mount(element, options) {
    var container = typeof element === 'string' ? document.querySelector(element) : element;
    if (!container) return Promise.reject(new Error('GeoMap: container not found: ' + element));
    if (container._geoMap) return Promise.resolve(container._geoMap);

    try {
      if (!global.maplibregl || !global.pmtiles) throw new Error('MapLibre or PMTiles library is missing');
      var protocol = new global.pmtiles.Protocol();
      global.maplibregl.addProtocol('pmtiles', protocol.tile);
    } catch (error) {
      renderFallback(container, error);
      return Promise.reject(error);
    }

    var opts = options || {};
    var center = opts.center || { lat: 36.7823, lng: 137.1105 };
    var map = new global.maplibregl.Map({
      container: container,
      center: [center.lng, center.lat],
      zoom: typeof opts.zoom === 'number' ? opts.zoom : 17,
      maxBounds: JAPAN_BOUNDS,
      style: '/maps/map.json',
      localIdeographFontFamily: 'Noto Sans JP, sans-serif',
      attributionControl: true,
    });
    map.addControl(new global.maplibregl.NavigationControl(), 'top-right');

    var state = { userMarker: null, targets: Object.create(null), centerLocked: true };
    var pendingUser = null;
    var pendingTargets = [];

    function renderUserAccuracy(pos, color) {
      var data = { type: 'Feature', geometry: { type: 'Point', coordinates: [pos.lng, pos.lat] }, properties: {} };
      var source = map.getSource('geo-user-accuracy');
      if (!source) {
        map.addSource('geo-user-accuracy', { type: 'geojson', data: data });
        map.addLayer({ id: 'geo-user-accuracy', type: 'circle', source: 'geo-user-accuracy', paint: { 'circle-radius': 28, 'circle-color': color, 'circle-opacity': 0.18, 'circle-stroke-color': color, 'circle-stroke-opacity': 0.7, 'circle-stroke-width': 2 } });
      } else source.setData(data);
    }

    function setUserPosition(pos) {
      if (!pos || typeof pos.lat !== 'number' || typeof pos.lng !== 'number') return;
      pendingUser = pos;
      var color = pos.provider === 'qzss' ? '#E05C35' : (pos.provider === 'simulated' ? '#607D8B' : '#2196F3');
      var point = [pos.lng, pos.lat];
      if (!state.userMarker) state.userMarker = new global.maplibregl.Marker({ element: markerElement(color, 20) }).setLngLat(point).addTo(map);
      else state.userMarker.setLngLat(point);
      if (map.isStyleLoaded()) renderUserAccuracy(pos, color);
      if (state.centerLocked) map.easeTo({ center: point, duration: 300 });
    }

    function removeTarget(id) {
      var target = state.targets[id];
      if (!target) return;
      target.marker.remove();
      if (map.isStyleLoaded()) {
        if (map.getLayer(target.layerId)) map.removeLayer(target.layerId);
        if (map.getSource(target.sourceId)) map.removeSource(target.sourceId);
      }
      delete state.targets[id];
    }

    function renderTargets() {
      pendingTargets.forEach(function (target) {
        var point = [target.position.lng, target.position.lat];
        var color = target.color || '#E05C35';
        var sourceId = 'geo-target-' + target.id;
        var layerId = sourceId + '-area';
        var data = { type: 'Feature', geometry: { type: 'Point', coordinates: point }, properties: {} };
        if (!map.getSource(sourceId)) {
          map.addSource(sourceId, { type: 'geojson', data: data });
          map.addLayer({ id: layerId, type: 'circle', source: sourceId, paint: { 'circle-radius': 24, 'circle-color': color, 'circle-opacity': 0.12, 'circle-stroke-color': color, 'circle-stroke-width': 2 } });
        }
        var current = state.targets[target.id];
        if (!current) {
          current = { marker: new global.maplibregl.Marker({ element: markerElement(color, 18) }).setLngLat(point).setPopup(new global.maplibregl.Popup({ offset: 12 }).setText(target.title || target.id)).addTo(map), sourceId: sourceId, layerId: layerId };
          state.targets[target.id] = current;
        } else {
          current.marker.setLngLat(point);
          map.getSource(sourceId).setData(data);
        }
      });
    }

    function setTargets(list) {
      pendingTargets = Array.isArray(list) ? list.filter(function (target) { return target && target.id && target.position; }) : [];
      var ids = Object.create(null);
      pendingTargets.forEach(function (target) { ids[target.id] = true; });
      Object.keys(state.targets).forEach(function (id) { if (!ids[id]) removeTarget(id); });
      if (map.isStyleLoaded()) renderTargets();
    }

    map.on('load', function () {
      if (pendingUser) setUserPosition(pendingUser);
      renderTargets();
    });

    var instance = {
      setUserPosition: setUserPosition,
      setTargets: setTargets,
      setCenterLocked: function (locked) { state.centerLocked = !!locked; },
      panTo: function (pos) { if (pos && typeof pos.lat === 'number') map.easeTo({ center: [pos.lng, pos.lat] }); },
      getNativeMap: function () { return map; },
      destroy: function () { Object.keys(state.targets).forEach(removeTarget); if (state.userMarker) state.userMarker.remove(); map.remove(); delete container._geoMap; },
    };
    container._geoMap = instance;
    var fallbackActivated = false;
    map.on('error', function (event) {
      if (event && event.error) console.error('MapLibre error:', event.error);
      var errorText = event && event.error ? String(event.error.message || event.error) : '';
      if (!fallbackActivated && ((event && event.sourceId === 'openmaptiles') || errorText.indexOf('map.pmtiles') !== -1)) {
        fallbackActivated = true;
        map.setStyle(GSI_FALLBACK_STYLE);
      }
    });
    return Promise.resolve(instance);
  }

  global.GeoMap = { mount: mount, state: function () { return 'ready'; }, JAPAN_BOUNDS: JAPAN_BOUNDS };
})(window);
