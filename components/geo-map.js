import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Protocol, PMTiles } from 'pmtiles';

/* GeoPuzzle - MapLibre GL JS + PMTiles map component
 *
 * This component only renders maps and map objects. It does not know about QZ1,
 * WebSocket, Web Serial, or navigator.geolocation. Position data is injected from
 * the outside through setUserPosition().
 */

const DEFAULT_CENTER = { lat: 36.7778, lng: 137.1235 };
const DEFAULT_ZOOM = 16;
const DEFAULT_PM_TILES_URL = '/maps/map.pmtiles';

let protocolRegistered = false;
let protocol = null;
const pmtilesCache = new Map();

function registerPMTilesProtocol() {
  if (protocolRegistered) return protocol;
  protocol = new Protocol();
  maplibregl.addProtocol('pmtiles', protocol.tile);
  protocolRegistered = true;
  return protocol;
}

function normalizeLngLat(pos) {
  if (!pos) return null;
  const lat = typeof pos.lat === 'number' ? pos.lat : pos.latitude;
  const lng = typeof pos.lng === 'number' ? pos.lng : pos.longitude;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  return { lat, lng };
}

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

async function assertPMTilesAvailable(url) {
  const res = await fetch(url, { method: 'HEAD', cache: 'no-store' });
  const contentType = res.headers.get('content-type') || '';
  if (!res.ok || contentType.includes('text/html')) {
    throw new Error(`PMTiles file is not available: ${url} (${res.status})`);
  }
}

async function getPMTilesMetadata(url) {
  if (!pmtilesCache.has(url)) {
    const pmtiles = new PMTiles(url);
    pmtilesCache.set(url, pmtiles);
    registerPMTilesProtocol().add(pmtiles);
  }
  const pmtiles = pmtilesCache.get(url);
  try {
    return await pmtiles.getMetadata();
  } catch (error) {
    console.warn('PMTiles metadata could not be read. Falling back to common layer names.', error);
    return {};
  }
}

function hasLayer(layerNames, name) {
  return layerNames.includes(name);
}

function firstLayer(layerNames, names) {
  return names.find((name) => hasLayer(layerNames, name));
}

function createPMTilesStyle(pmtilesUrl, metadata) {
  const vectorLayers = Array.isArray(metadata.vector_layers) ? metadata.vector_layers : [];
  const layerNames = vectorLayers.map((layer) => layer.id).filter(Boolean);

  const water = firstLayer(layerNames, ['water', 'waterway', 'water_name']);
  const landuse = firstLayer(layerNames, ['landuse', 'landcover', 'park', 'aeroway']);
  const roads = firstLayer(layerNames, ['transportation', 'road', 'roads']);
  const buildings = firstLayer(layerNames, ['building', 'buildings']);
  const boundaries = firstLayer(layerNames, ['boundary', 'admin']);

  const layers = [
    { id: 'background', type: 'background', paint: { 'background-color': '#EEF2EE' } },
  ];

  if (landuse) {
    layers.push({
      id: 'pmtiles-landuse',
      type: 'fill',
      source: 'local-map',
      'source-layer': landuse,
      paint: { 'fill-color': '#D9E5D2', 'fill-opacity': 0.75 },
    });
  }

  if (water) {
    layers.push({
      id: 'pmtiles-water',
      type: 'fill',
      source: 'local-map',
      'source-layer': water,
      paint: { 'fill-color': '#9FC7D9', 'fill-opacity': 0.9 },
    });
  }

  if (buildings) {
    layers.push({
      id: 'pmtiles-buildings',
      type: 'fill',
      source: 'local-map',
      'source-layer': buildings,
      minzoom: 14,
      paint: { 'fill-color': '#C8B8A6', 'fill-opacity': 0.55 },
    });
  }

  if (roads) {
    layers.push(
      {
        id: 'pmtiles-roads-casing',
        type: 'line',
        source: 'local-map',
        'source-layer': roads,
        paint: {
          'line-color': '#FFFFFF',
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.8, 14, 2.4, 18, 7],
        },
      },
      {
        id: 'pmtiles-roads',
        type: 'line',
        source: 'local-map',
        'source-layer': roads,
        paint: {
          'line-color': '#8A8F84',
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.4, 14, 1.2, 18, 3.5],
        },
      }
    );
  }

  if (boundaries) {
    layers.push({
      id: 'pmtiles-boundaries',
      type: 'line',
      source: 'local-map',
      'source-layer': boundaries,
      paint: { 'line-color': '#8B9A8E', 'line-dasharray': [2, 2], 'line-width': 1 },
    });
  }

  return {
    version: 8,
    sources: {
      'local-map': {
        type: 'vector',
        url: `pmtiles://${pmtilesUrl}`,
        attribution: metadata.attribution || '',
      },
    },
    layers,
  };
}

async function loadMapLibre() {
  registerPMTilesProtocol();
  return maplibregl;
}

async function mount(el, options = {}) {
  const container = typeof el === 'string' ? document.querySelector(el) : el;
  if (!container) throw new Error(`GeoMap: container not found: ${el}`);
  if (container._geoMap) return container._geoMap;

  const pmtilesUrl = options.pmtilesUrl || DEFAULT_PM_TILES_URL;
  const center = normalizeLngLat(options.center) || DEFAULT_CENTER;
  const zoom = typeof options.zoom === 'number' ? options.zoom : DEFAULT_ZOOM;

  try {
    await assertPMTilesAvailable(pmtilesUrl);
    const metadata = await getPMTilesMetadata(pmtilesUrl);
    const style = createPMTilesStyle(pmtilesUrl, metadata);

    const mapRoot = createMapRoot(container);
    const map = new maplibregl.Map({
      container: mapRoot,
      style,
      center: [center.lng, center.lat],
      zoom,
      attributionControl: true,
      cooperativeGestures: false,
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

    const ready = createDeferred();
    map.once('load', ready.resolve);
    map.once('error', (event) => {
      if (!map.loaded()) ready.reject(event.error || new Error('MapLibre failed to load'));
    });

    const instance = createInstance(map, container, ready.promise);
    container._geoMap = instance;
    return instance;
  } catch (error) {
    renderFallback(container, error, pmtilesUrl);
    throw error;
  }
}

function clearMapChildren(container) {
  container.querySelectorAll('.geo-maplibre-canvas, .maplibre-fallback').forEach((el) => el.remove());
}

function createMapRoot(container) {
  clearMapChildren(container);
  const mapRoot = document.createElement('div');
  mapRoot.className = 'geo-maplibre-canvas';
  container.prepend(mapRoot);
  return mapRoot;
}

function renderFallback(container, error, pmtilesUrl) {
  clearMapChildren(container);
  const wrap = document.createElement('div');
  wrap.className = 'maplibre-fallback';

  const title = document.createElement('div');
  title.className = 'maplibre-fallback-title';
  title.textContent = 'PMTiles の地図データが必要です';

  const body = document.createElement('div');
  body.className = 'maplibre-fallback-body';
  body.textContent = [
    `配置先: ${pmtilesUrl}`,
    'オンライン地図タイルには切り替えていません。',
    error && error.message ? `詳細: ${error.message}` : '',
  ].filter(Boolean).join('\n');

  wrap.appendChild(title);
  wrap.appendChild(body);
  container.appendChild(wrap);
}

function createUserMarkerElement(provider) {
  const el = document.createElement('div');
  el.className = `geo-user-marker ${provider === 'qzss' || provider === 'simulated' ? 'is-qzss' : ''}`;
  return el;
}

function createTargetMarkerElement() {
  const el = document.createElement('div');
  el.className = 'geo-target-marker';
  return el;
}

function circleFeature(id, pos, radius, color) {
  return {
    type: 'Feature',
    id,
    properties: { radius, color },
    geometry: { type: 'Point', coordinates: [pos.lng, pos.lat] },
  };
}

function createInstance(map, container, ready) {
  const state = {
    userMarker: null,
    userAccuracy: null,
    targets: new Map(),
    centerLocked: true,
    targetFeatures: [],
  };

  ready.then(() => {
    if (!map.getSource('geo-user-accuracy')) {
      map.addSource('geo-user-accuracy', { type: 'geojson', data: emptyCollection() });
      map.addLayer({
        id: 'geo-user-accuracy-fill',
        type: 'circle',
        source: 'geo-user-accuracy',
        paint: {
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.16,
          'circle-stroke-color': ['get', 'color'],
          'circle-stroke-opacity': 0.65,
          'circle-stroke-width': 2,
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 4, 16, ['max', 8, ['get', 'radius']], 19, ['*', ['get', 'radius'], 4]],
        },
      });
    }

    if (!map.getSource('geo-target-radii')) {
      map.addSource('geo-target-radii', { type: 'geojson', data: emptyCollection() });
      map.addLayer({
        id: 'geo-target-radii-fill',
        type: 'circle',
        source: 'geo-target-radii',
        paint: {
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.13,
          'circle-stroke-color': ['get', 'color'],
          'circle-stroke-opacity': 0.85,
          'circle-stroke-width': 2,
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 4, 16, ['max', 7, ['get', 'radius']], 19, ['*', ['get', 'radius'], 4]],
        },
      });
      syncTargetsSource();
    }
  }).catch((error) => console.warn('Map overlays were not initialized.', error));

  function emptyCollection() {
    return { type: 'FeatureCollection', features: [] };
  }

  function setGeoJson(sourceId, features) {
    const source = map.getSource(sourceId);
    if (source) source.setData({ type: 'FeatureCollection', features });
  }

  function setUserPosition(pos) {
    const normalized = normalizeLngLat(pos);
    if (!normalized) return;
    const lngLat = [normalized.lng, normalized.lat];
    const provider = pos.provider || 'gps';

    if (!state.userMarker) {
      state.userMarker = new maplibregl.Marker({ element: createUserMarkerElement(provider), anchor: 'center' })
        .setLngLat(lngLat)
        .addTo(map);
    } else {
      state.userMarker.setLngLat(lngLat);
    }

    const markerEl = state.userMarker.getElement();
    markerEl.classList.toggle('is-qzss', provider === 'qzss' || provider === 'simulated');
    if (typeof pos.bearing === 'number') markerEl.style.setProperty('--bearing', `${pos.bearing}deg`);

    const accuracy = typeof pos.accuracy === 'number' ? pos.accuracy : 5;
    state.userAccuracy = circleFeature('user-accuracy', normalized, accuracy, provider === 'qzss' || provider === 'simulated' ? '#E05C35' : '#2196F3');
    ready.then(() => setGeoJson('geo-user-accuracy', [state.userAccuracy]));

    if (state.centerLocked) map.panTo(lngLat, { duration: 350 });
  }

  function setTargets(targets) {
    const nextIds = new Set();
    const list = Array.isArray(targets) ? targets : [];

    list.forEach((target) => {
      if (!target || !target.id || !target.position) return;
      const pos = normalizeLngLat(target.position);
      if (!pos) return;
      nextIds.add(target.id);

      const lngLat = [pos.lng, pos.lat];
      const color = target.color || '#E05C35';
      const radius = typeof target.radius === 'number' ? target.radius : 0.5;
      const existing = state.targets.get(target.id);

      if (existing) {
        existing.marker.setLngLat(lngLat);
        existing.feature = circleFeature(target.id, pos, radius, color);
      } else {
        const marker = new maplibregl.Marker({ element: createTargetMarkerElement(), anchor: 'center' })
          .setLngLat(lngLat)
          .addTo(map);
        marker.getElement().title = target.title || target.id;
        state.targets.set(target.id, { marker, feature: circleFeature(target.id, pos, radius, color) });
      }
    });

    Array.from(state.targets.keys()).forEach((id) => {
      if (!nextIds.has(id)) removeTarget(id);
    });

    syncTargetsSource();
  }

  function syncTargetsSource() {
    state.targetFeatures = Array.from(state.targets.values()).map((entry) => entry.feature);
    ready.then(() => setGeoJson('geo-target-radii', state.targetFeatures));
  }

  function removeTarget(id) {
    const entry = state.targets.get(id);
    if (!entry) return;
    entry.marker.remove();
    state.targets.delete(id);
  }

  function setCenterLocked(locked) {
    state.centerLocked = !!locked;
    if (state.centerLocked && state.userMarker) {
      map.panTo(state.userMarker.getLngLat(), { duration: 350 });
    }
  }

  function panTo(pos) {
    const normalized = normalizeLngLat(pos);
    if (!normalized) return;
    map.panTo([normalized.lng, normalized.lat], { duration: 350 });
  }

  function getNativeMap() {
    return map;
  }

  function destroy() {
    state.targets.forEach((entry) => entry.marker.remove());
    state.targets.clear();
    if (state.userMarker) state.userMarker.remove();
    map.remove();
    delete container._geoMap;
  }

  return {
    mount: () => mount(container),
    setUserPosition,
    setTargets,
    setCenterLocked,
    panTo,
    getNativeMap,
    destroy,
  };
}

window.GeoMap = {
  mount,
  loadMapLibre,
  registerPMTilesProtocol,
  state: () => (protocolRegistered ? 'ready' : 'idle'),
};




