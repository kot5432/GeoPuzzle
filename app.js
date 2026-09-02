/* ===================================
   GeoPuzzle App Logic
   =================================== */

// ===================================
// State
// ===================================
let currentUser = { id: 'demo', name: 'k', email: 'k.kyogaku.123@gmail.com' };
let currentScreen = 'home';
const STATE_VERSION = '2026-09-01-map-reset';
if (localStorage.getItem('geopuzzle_state_version') !== STATE_VERSION) {
  localStorage.removeItem('geopuzzle_collection');
  localStorage.removeItem('geopuzzle_mission_progress');
  localStorage.setItem('geopuzzle_state_version', STATE_VERSION);
}
let collection = JSON.parse(localStorage.getItem('geopuzzle_collection') || '[]');
let currentMissionId = null;
let currentHintLevel = 1;
let missionProgress = JSON.parse(localStorage.getItem('geopuzzle_mission_progress') || '{}');
let currentDistance = 86;

// Debug Mode Configuration
const debugConfig = {
  debugMode: true,  // 開発時はtrue、本番時はfalse
  forceClearEnabled: true  // 強制クリア機能の有効化
};

// Serial Connection State
let serialPort = null;
let serialReader = null;
let isConnected = false;
let currentPosition = { latitude: null, longitude: null };
let useQZSS = false;  // みちびきを使用するかどうか

// MapLibre (GeoMap コンポーネントの Promise を保持)
let homeMap = null;
let exploreMap = null;

// Navigation mode based on distance (3-stage approach)
const NAV_MODES = {
  AREA_HINT: 'area_hint',      // ホーム: 探索エリアのみ
  DIRECTION: 'direction',      // 100m〜: 方向＋おおよその距離
  PRECISE: 'precise',          // 30m〜: 方向＋正確な距離
  EXPLORATION: 'exploration',  // 10m〜: 距離中心＋「周囲を探そう」
  FINAL: 'final',              // 3m〜: ナビ情報を弱める
  QZSS: 'qzss'                // 1m以内: QZ1で一点判定
};

let currentNavMode = NAV_MODES.AREA_HINT;

// Periodic status check
let statusCheckInterval = null;

// Demo spot data
const SPOTS = [
  {
    id: 'akagi',
    name: '神楽坂の赤城神社',
    place: '東京都 新宿区・東京の静かな屋上神社',
    date: 'JUN 18, 2025',
    status: '探索中',
    icon: '📍',
  },
];

// QZSS Data Store
const qzssData = {
  position: { latitude: null, longitude: null, altitude: null },
  accuracy: { hdop: null, pdop: null, vdop: null },
  satellites: {
    total: 0,
    gps: 0,
    qzss: 0,
    glonass: 0,
    details: []
  },
  fixQuality: null,
  timestamp: null,
  signalQuality: 'unknown', // 'excellent', 'good', 'poor', 'none'
};

// Map Configuration for GeoPuzzle (Leaflet)
const MAP_CONFIG = {
  center: {
    lat: 36.7813,  // 海王丸パーク中心
    lng: 137.1076
  },
  zoom: 13  // 富山県全域が見えるズームレベル
};

// Mission data structure
const MISSIONS = [
  {
    id: "mission1",
    title: "4つの景色が重なる場所",
    description: "海・山・橋・船。すべてが見える「一点」を探そう。",
    discoveredName: "展望広場",
    discoverySummary: "富山湾、立山連峰、新湊大橋、帆船海王丸を一望できる場所です。",
    targetLocation: {
      latitude: 36.7813,  // 海王丸パーク展望広場の実際の座標
      longitude: 137.1076,
      tolerance: 0.5  // 50cm（みちびき受信機）
    },
    hints: [
      { level: 1, text: "4つが同時に見える場所を探してみよう。" },
      { level: 2, text: "海を正面にして、周りを見渡してみよう。" },
      { level: 3, text: "少し高い場所から、船と橋を一緒に探そう。" },
      { level: 4, text: "4つの景色が重なる場所に立ってみよう。" }
    ],
    reward: {
      type: "stamp",
      name: "絶景発見者",
      icon: "🏔️"
    }
  },
  {
    id: "mission2",
    title: "幸せを願う音",
    description: "船の中にある、願いを託せる音を探そう。",
    discoveredName: "幸せのベル（タイムベル）",
    discoverySummary: "海王丸の船内にある、時間を知らせるためのベルです。",
    targetLocation: {
      latitude: 36.7812,  // 海王丸船内の実際の座標
      longitude: 137.1075,
      tolerance: 0.5  // 50cm（みちびき受信機）
    },
    hints: [
      { level: 1, text: "海王丸の中を探してみよう。" },
      { level: 2, text: "時間を知らせるために使われるものを探そう。" },
      { level: 3, text: "船の中にある、大きなベルを探そう。" },
      { level: 4, text: "ベルの前で、願いを託してみよう。" }
    ],
    reward: {
      type: "stamp",
      name: "幸せの鐘",
      icon: "🔔"
    }
  },
  {
    id: "mission3",
    title: "ふたりの証を探せ",
    description: "恋人たちの場所であることを示す、特別な証を探そう。",
    discoveredName: "恋人の聖地記念モニュメント",
    discoverySummary: "海王丸パークにある、恋人の聖地に選定されたことを示すモニュメントです。",
    targetLocation: {
      latitude: 36.7811,  // 恋人の聖地モニュメントの実際の座標
      longitude: 137.1074,
      tolerance: 0.5  // 50cm（みちびき受信機）
    },
    hints: [
      { level: 1, text: "海王丸パークには、特別に選ばれた場所がある。" },
      { level: 2, text: "ふたりの思い出を残したくなるものを探そう。" },
      { level: 3, text: "恋人たちの場所を示すものを探そう。" },
      { level: 4, text: "その証の前に立ってみよう。" }
    ],
    reward: {
      type: "stamp",
      name: "愛の聖地",
      icon: "💕"
    }
  }
];

// ===================================
// GeoMap Bridge Functions
// ===================================

function ensureMapsMounted(screenName) {
  const mountExplore = screenName === 'explore';

  const center = {
    lat: MAP_CONFIG.center.lat,
    lng: MAP_CONFIG.center.lng,
  };

  if (!homeMap) {
    homeMap = (typeof GeoMap !== 'undefined' && GeoMap.mount)
      ? GeoMap.mount('#home-map-container', { center, zoom: MAP_CONFIG.zoom, minZoom: 9 }).catch(err => {
          console.warn('[homeMap] mount failed:', err?.message);
          return null;
        })
      : Promise.resolve(null);
  }
  if (mountExplore && !exploreMap) {
    exploreMap = (typeof GeoMap !== 'undefined' && GeoMap.mount)
      ? GeoMap.mount('#explore-map-container', { center, zoom: 17 }).catch(err => {
          console.warn('[exploreMap] mount failed:', err?.message);
          return null;
        })
      : Promise.resolve(null);
  }
  return Promise.all([homeMap, exploreMap]).then(() => {
    const visibleMap = screenName === 'explore' ? exploreMap : homeMap;
    if (visibleMap) {
      const nativeMap = visibleMap.getNativeMap?.();
      if (nativeMap) nativeMap.resize();
    }
    syncTargetsToHomeMap();
    renderMissionAreasOnHomeMap();
    if (currentMissionId) syncTargetsToExploreMap();
    syncPositionToMaps();
  });
}

function getUserPositionConnectionState() {
  const hasPosition = !!(currentPosition && currentPosition.latitude !== null && currentPosition.longitude !== null);
  const hasValidSignal = isConnected && qzssData.signalQuality && qzssData.signalQuality !== 'none';
  const shouldShowUserPosition = !!(isConnected && hasPosition && hasValidSignal);

  return {
    connected: isConnected,
    hasPosition,
    hasValidSignal,
    shouldShowUserPosition,
    statusText: isConnected
      ? (hasValidSignal ? '接続中（位置情報更新中）' : '未接続（受信なし）')
      : '未接続（位置情報なし）',
  };
}

async function syncPositionToMaps() {
  const [hMap, eMap] = await Promise.all([
    homeMap || Promise.resolve(null),
    exploreMap || Promise.resolve(null),
  ]);

  const state = getUserPositionConnectionState();
  if (!state.shouldShowUserPosition || !currentPosition?.latitude || !currentPosition?.longitude) {
    try {
      if (hMap && hMap.removeUserPosition) hMap.removeUserPosition();
      if (eMap && eMap.removeUserPosition) eMap.removeUserPosition();
    } catch (e) {
      console.warn('removeUserPosition error:', e);
    }
    return;
  }

  let accuracy;
  if (useQZSS && qzssData.accuracy?.hdop) {
    accuracy = Math.max(0.5, Math.min(20.0, qzssData.accuracy.hdop * 1.2));
  } else if (useQZSS) {
    accuracy = 1.0;
  } else {
    accuracy = 10.0;
  }
  const provider = useQZSS ? 'qzss' : (debugConfig.debugMode ? 'simulated' : 'gps');
  const payload = {
    lat: currentPosition.latitude,
    lng: currentPosition.longitude,
    accuracy,
    provider,
  };
  try {
    if (hMap && hMap.setUserPosition) hMap.setUserPosition(payload);
    if (eMap && eMap.setUserPosition) eMap.setUserPosition(payload);
  } catch (e) {
    console.warn('syncPositionToMaps error:', e);
  }
}

async function syncTargetsToHomeMap() {
  const [hMap] = await Promise.all([homeMap || Promise.resolve(null)]);
  if (!hMap) return;

  if (hMap.setTargets) hMap.setTargets([]);

  const focusPosition = currentPosition?.latitude && currentPosition?.longitude
    ? { lat: currentPosition.latitude, lng: currentPosition.longitude }
    : MAP_CONFIG.center;

  if (hMap.panTo) hMap.panTo(focusPosition);

  if (hMap.setExplorationArea) {
    hMap.setExplorationArea({
      center: focusPosition,
      radius: 120,
      color: '#F4B942',
      fillOpacity: 0.18,
      strokeOpacity: 0.5,
    });
  }
}

async function syncTargetsToExploreMap() {
  const [eMap] = await Promise.all([exploreMap || Promise.resolve(null)]);
  if (!eMap || !eMap.setTargets) return;
  if (!currentMissionId) {
    eMap.setTargets([]);
    return;
  }
  const mission = MISSIONS.find(m => m.id === currentMissionId);
  if (!mission) return;
  eMap.setTargets([{
    id: mission.id,
    position: { lat: mission.targetLocation.latitude, lng: mission.targetLocation.longitude },
    radius: mission.targetLocation.tolerance || 0.5,
    color: '#E05C35',
    title: mission.title,
    fillOpacity: 0.2,
  }]);
}

// ===================================
// Screen Management
// ===================================
const NAV_IDS = ['nav-home', 'nav-explore', 'nav-record'];
const SCREEN_IDS = {
  home: 'home-screen',
  'mission-detail': 'mission-detail-screen',
  explore: 'explore-screen',
  record: 'record-screen',
};

function showScreen(name) {
  // Hide all screens inside main-app
  Object.values(SCREEN_IDS).forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });

  // Show target screen
  const target = document.getElementById(SCREEN_IDS[name]);
  if (target) target.classList.remove('hidden');

  // Update nav active state (only for main nav screens)
  const navOnlyScreens = ['home', 'explore', 'record'];
  if (navOnlyScreens.includes(name)) {
    NAV_IDS.forEach((navId) => {
      const btn = document.getElementById(navId);
      if (!btn) return;
      const screen = btn.dataset.screen;
      btn.classList.toggle('active', screen === name);
    });
  }

  currentScreen = name;

  // Screen-specific actions
  if (name === 'record') renderDiscoveryList();
  if (name === 'home') {
    ensureMapsMounted();
  }
  if (name === 'explore') {
    ensureMapsMounted('explore').then(() => {
      attachDebugMapClickHandler();
    });
  }
}

// ===================================
// Legacy Map Wrappers (互換性のため残す)
// ===================================
function updateTargetMarkerOnMap(lat, lon) {
  if (currentMissionId) syncTargetsToExploreMap();
}
function updatePlayerMarkerOnMap(lat, lon) {
  currentPosition.latitude = lat;
  currentPosition.longitude = lon;
  syncPositionToMaps();
}
function updateDirectionLineOnMap() { /* noop: 方向コンパスUIで代用 */ }

// ===================================
// Init
// ===================================
document.addEventListener('DOMContentLoaded', () => {
  // Initialize MapLibre + PMTiles (GeoMap コンポーネント)
  ensureMapsMounted();
  // Check if already "logged in" (demo: always show login first)
  const loginScreen = document.getElementById('login-screen');
  const mainApp = document.getElementById('main-app');

  // Login
  const loginBtn = document.getElementById('login-btn');
  if (loginBtn) {
    loginBtn.addEventListener('click', () => {
      loginScreen.classList.add('hidden');
      mainApp.classList.remove('hidden');
      showScreen('home');
    });
  }

  const loginSecondaryBtn = document.getElementById('login-secondary-btn');
  if (loginSecondaryBtn) {
    loginSecondaryBtn.addEventListener('click', () => {
      loginScreen.classList.add('hidden');
      mainApp.classList.remove('hidden');
      showScreen('home');
    });
  }

  // Nav links
  NAV_IDS.forEach((navId) => {
    const btn = document.getElementById(navId);
    if (!btn) return;
    btn.addEventListener('click', () => {
      showScreen(btn.dataset.screen);
    });
  });

  // Logo click → home
  const logoBtn = document.getElementById('nav-logo-btn');
  if (logoBtn) {
    logoBtn.addEventListener('click', () => showScreen('home'));
  }

  // Home → Explore
  const resumeBtn = document.getElementById('resume-explore-btn');
  if (resumeBtn) {
    resumeBtn.addEventListener('click', () => showScreen('explore'));
  }

  // Explore: Update Location
  const updateLocationBtn = document.getElementById('update-location-btn');
  if (updateLocationBtn) {
    updateLocationBtn.addEventListener('click', simulateLocationUpdate);
  }

  // Explore: Check Arrival
  const checkArriveBtn = document.getElementById('check-arrive-btn');
  if (checkArriveBtn) {
    checkArriveBtn.addEventListener('click', checkArrival);
  }

  // Explore: Next Hint
  const nextHintBtn = document.getElementById('next-hint-btn');
  if (nextHintBtn) {
    nextHintBtn.addEventListener('click', showNextHint);
  }

  // Discovery overlay buttons
  const addCollectionBtn = document.getElementById('add-collection-btn');
  if (addCollectionBtn) {
    addCollectionBtn.addEventListener('click', () => {
      closeDiscovery();
      showScreen('record');
    });
  }

  const backHomeDiscoveryBtn = document.getElementById('back-home-discovery-btn');
  if (backHomeDiscoveryBtn) {
    backHomeDiscoveryBtn.addEventListener('click', () => {
      closeDiscovery();
      showScreen('home');
    });
  }

  // FOUND Screen
  const foundNextBtn = document.getElementById('found-next-btn');
  if (foundNextBtn) {
    foundNextBtn.addEventListener('click', () => {
      showDiscoveryDetail();
    });
  }

  // Mission Detail Screen
  const missionDetailBackBtn = document.getElementById('mission-detail-back-btn');
  if (missionDetailBackBtn) {
    missionDetailBackBtn.addEventListener('click', () => {
      showScreen('home');
    });
  }

  const missionDetailStartBtn = document.getElementById('mission-detail-start-btn');
  if (missionDetailStartBtn) {
    missionDetailStartBtn.addEventListener('click', () => {
      if (currentMissionId) {
        showScreen('explore');
        ensureMapsMounted('explore').then(() => {
          updateExploreScreen();
        });
      }
    });
  }

  // Logout
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      mainApp.classList.add('hidden');
      loginScreen.classList.remove('hidden');
    });
  }

  // Update user avatar/name display
  updateUserUI();
  updateStats();

  // Start distance counter animation on explore screen
  startDistanceAnimation();

  // Debug mode controls
  if (debugConfig.debugMode) {
    const forceClearBtn = document.getElementById('force-clear-btn');
    if (forceClearBtn) {
      forceClearBtn.addEventListener('click', forceClear);
    }

    document.querySelectorAll('[data-debug-toggle]').forEach((button) => {
      button.addEventListener('click', toggleDebugPanel);
    });

    document.getElementById('debug-show-all-hints-btn')?.addEventListener('click', showAllHints);
    document.getElementById('debug-simulate-qzss-btn')?.addEventListener('click', () => simulateDebugPosition('qzss', 5));
    document.getElementById('debug-simulate-gps-btn')?.addEventListener('click', () => simulateDebugPosition('gps', 5));
    document.getElementById('debug-teleport-approach-btn')?.addEventListener('click', () => simulateDebugPosition('gps', 8));
    document.getElementById('debug-teleport-hot-btn')?.addEventListener('click', () => simulateDebugPosition('qzss', 0.5));
    document.getElementById('debug-reset-missions-btn')?.addEventListener('click', resetMissions);
    document.getElementById('debug-clear-all-btn')?.addEventListener('click', clearAllMissions);

    // Show debug panel by default in debug mode
    updateDebugUI();
  }

  // Serial connection controls
  const connectSerialBtn = document.getElementById('connect-serial-btn');
  if (connectSerialBtn) {
    connectSerialBtn.addEventListener('click', connectSerialPort);
  }

  const disconnectSerialBtn = document.getElementById('disconnect-serial-btn');
  if (disconnectSerialBtn) {
    disconnectSerialBtn.addEventListener('click', disconnectSerialPort);
  }

  // Initialize serial connection UI
  updateSerialConnectionUI();
});

// ===================================
// User UI
// ===================================
function updateUserUI() {
  const initial = currentUser.name.charAt(0).toUpperCase();

  const navAvatar = document.getElementById('nav-avatar');
  if (navAvatar) navAvatar.textContent = initial;

  const recordAvatar = document.getElementById('record-avatar');
  if (recordAvatar) recordAvatar.textContent = initial;

  const recordName = document.getElementById('record-name');
  if (recordName) recordName.textContent = `${currentUser.name}さんの記録`;

  const recordEmail = document.getElementById('record-email');
  if (recordEmail) recordEmail.textContent = currentUser.email;
}

// ===================================
// Location Simulation
// ===================================
function startDistanceAnimation() {
  // Gently oscillate distance to simulate movement (only when not using QZSS)
  setInterval(() => {
    if (!useQZSS) {
      const delta = Math.floor(Math.random() * 7) - 3;
      currentDistance = Math.max(10, currentDistance + delta);
      const distEl = document.getElementById('explore-distance');
      if (distEl) distEl.textContent = currentDistance;
    }

    // Update debug UI if in debug mode
    if (debugConfig.debugMode) {
      updateDebugUI();
    }
  }, 3000);
}

function simulateLocationUpdate() {
  const btn = document.getElementById('update-location-btn');
  if (!btn) return;

  // If QZSS is connected, use real data instead of simulation
  if (useQZSS && currentPosition.latitude && currentPosition.longitude) {
    btn.textContent = '更新中...';
    btn.disabled = true;

    setTimeout(() => {
      // Force update with real QZSS data
      updateDistanceFromTarget();
      updatePlayerMarkerOnMap(currentPosition.latitude, currentPosition.longitude);

      btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13">
          <line x1="22" y1="2" x2="11" y2="13"/>
          <polygon points="22 2 15 22 11 13 2 9 22 2"/>
        </svg>
        現在地を更新
      `;
      btn.disabled = false;
    }, 1200);
    return;
  }

  // Demo mode simulation: 目標地点周辺にランダムに移動し、地図に反映
  btn.textContent = '更新中...';
  btn.disabled = true;

  setTimeout(() => {
    // Decrease distance to simulate approach
    currentDistance = Math.max(15, currentDistance - Math.floor(Math.random() * 20 + 5));
    const distEl = document.getElementById('explore-distance');
    if (distEl) distEl.textContent = currentDistance;

    // デモ用に currentPosition を目標地点周辺（±0.0003度 ≈ 33m）に移動
    const mission = MISSIONS.find(m => m.id === currentMissionId);
    if (mission?.targetLocation?.latitude) {
      const lat0 = mission.targetLocation.latitude;
      const lng0 = mission.targetLocation.longitude;
      const jitterLat = (Math.random() - 0.5) * 0.0006;
      const jitterLng = (Math.random() - 0.5) * 0.0006;
      currentPosition.latitude = lat0 + jitterLat;
      currentPosition.longitude = lng0 + jitterLng;
    } else if (!currentPosition.latitude) {
      currentPosition.latitude = MAP_CONFIG.center.lat;
      currentPosition.longitude = MAP_CONFIG.center.lng;
    }
    syncPositionToMaps();

    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13">
        <line x1="22" y1="2" x2="11" y2="13"/>
        <polygon points="22 2 15 22 11 13 2 9 22 2"/>
      </svg>
      現在地を更新
    `;
    btn.disabled = false;
  }, 1200);
}

// ===================================
// Arrival Check
// ===================================
function checkArrival() {
  const btn = document.getElementById('check-arrive-btn');
  if (btn) {
    btn.textContent = '判定中...';
    btn.disabled = true;
  }

  setTimeout(() => {
    let arrived = false;

    if (useQZSS && currentPosition.latitude && currentPosition.longitude) {
      // Use actual QZSS position data
      const mission = MISSIONS.find(m => m.id === currentMissionId);
      if (mission) {
        const distance = calculateDistance(
          currentPosition.latitude,
          currentPosition.longitude,
          mission.targetLocation.latitude,
          mission.targetLocation.longitude
        );

        // Check if within tolerance (50cm for QZSS)
        arrived = distance <= mission.targetLocation.tolerance;
        console.log(`Distance to target: ${distance.toFixed(2)}m, Tolerance: ${mission.targetLocation.tolerance}m, Arrived: ${arrived}`);
      }
    } else {
      // MVP fallback: always succeed in debug mode
      arrived = debugConfig.debugMode;
      console.log('Using debug mode fallback for arrival check');
    }

    if (btn) {
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        到着判定
      `;
      btn.disabled = false;
    }

    if (arrived) {
      // Mark mission as completed
      if (currentMissionId) {
        completeMission(currentMissionId);
      }
      showDiscovery();
    } else {
      alert('まだ目標地点に到着していません。もっと近づいてください。');
    }
  }, 1000);
}

function completeMission(missionId) {
  if (!missionProgress[missionId]) {
    missionProgress[missionId] = {};
  }
  missionProgress[missionId].completed = true;
  missionProgress[missionId].completedAt = new Date().toISOString();

  localStorage.setItem('geopuzzle_mission_progress', JSON.stringify(missionProgress));

  // Add to collection
  if (!collection.includes(missionId)) {
    collection.push(missionId);
    localStorage.setItem('geopuzzle_collection', JSON.stringify(collection));
  }

  updateStats();
}

// ===================================
// Discovery Overlay
// ===================================
function showDiscovery() {
  // First show the FOUND screen
  showFound();
}

function showFound() {
  const foundOverlay = document.getElementById('found-overlay');
  if (!foundOverlay) return;

  // Update FOUND screen with mission info
  if (currentMissionId) {
    const mission = MISSIONS.find(m => m.id === currentMissionId);
    if (mission) {
      const subtitleEl = document.getElementById('found-subtitle');
      const missionNameEl = document.getElementById('found-mission-name');

      if (subtitleEl) subtitleEl.textContent = mission.description || '特別な一点を発見しました。';
      if (missionNameEl) missionNameEl.textContent = mission.discoveredName || mission.title;
    }
  }

  foundOverlay.classList.remove('hidden');
  foundOverlay.style.display = 'flex';
}

function showDiscoveryDetail() {
  const overlay = document.getElementById('discovery-overlay');
  if (overlay) {
    overlay.classList.remove('hidden');
    overlay.style.display = 'flex';

    // Update discovery content based on current mission
    if (currentMissionId) {
      const mission = MISSIONS.find(m => m.id === currentMissionId);
      if (mission) {
        const iconEl = document.getElementById('discovery-icon');
        const titleEl = document.getElementById('discovery-title');
        const messageEl = document.getElementById('discovery-message');
        const rewardEl = document.getElementById('reward-badge');

        if (iconEl) iconEl.textContent = mission.reward.icon;
        if (titleEl) titleEl.textContent = mission.discoveredName || mission.title;
        if (messageEl) messageEl.textContent = mission.discoverySummary || mission.description;
        const summaryEl = document.getElementById('discovery-summary');
        if (summaryEl) summaryEl.textContent = mission.discoverySummary || mission.description;
        if (rewardEl) rewardEl.textContent = mission.reward.name;
      }
    }
  }
}

function closeDiscovery() {
  const overlay = document.getElementById('discovery-overlay');
  const foundOverlay = document.getElementById('found-overlay');
  if (overlay) {
    overlay.classList.add('hidden');
    overlay.style.display = 'none';
  }
  if (foundOverlay) {
    foundOverlay.classList.add('hidden');
    foundOverlay.style.display = 'none';
  }
}

// ===================================
// Collection
// ===================================
function addToCollection(spotId) {
  if (!collection.includes(spotId)) {
    collection.push(spotId);
    localStorage.setItem('geopuzzle_collection', JSON.stringify(collection));
  }
  updateStats();
}

function updateStats() {
  const count = collection.length;
  const els = [
    document.getElementById('home-stat-spots'),
    document.getElementById('record-stat-cleared'),
    document.getElementById('record-stat-cities'),
    document.getElementById('record-stat-photos'),
  ];
  els.forEach((el) => {
    if (el) el.textContent = String(count).padStart(2, '0');
  });

  const countLabel = document.getElementById('record-count');
  if (countLabel) countLabel.textContent = `${String(count).padStart(2, '0')} / 12 LOCATIONS`;
}

// ===================================
// Discovery List Render
// ===================================
function renderDiscoveryList() {
  const list = document.getElementById('discovery-list');
  if (!list) return;

  const toShow = MISSIONS
    .filter((mission) => missionProgress[mission.id]?.completed)
    .map((mission) => ({
      id: mission.id,
      name: mission.discoveredName || mission.title,
      place: mission.discoverySummary || mission.description,
      date: missionProgress[mission.id].completedAt
        ? new Date(missionProgress[mission.id].completedAt).toLocaleDateString('ja-JP')
        : '-',
      status: '発見済み',
      icon: mission.reward.icon,
    }));

  if (toShow.length === 0) {
    list.innerHTML = '<div class="empty-state">まだ発見したスポットがありません</div>';
    return;
  }

  list.innerHTML = toShow.map((spot) => `
    <div class="discovery-item">
      <div class="discovery-item-thumb dark">${spot.icon}</div>
      <div class="discovery-item-info">
        <div class="discovery-item-name">${spot.name}</div>
        <div class="discovery-item-place">${spot.place}</div>
      </div>
      <div class="discovery-item-right">
        <div class="discovery-item-date">${spot.date}</div>
        <div class="discovery-item-status">${spot.status}</div>
      </div>
    </div>
  `).join('');
}

// ===================================
// Mission Select Render
// ===================================
function renderMissionSelect() {
  const list = document.getElementById('mission-select-list');
  if (!list) return;

  list.innerHTML = MISSIONS.map((mission, index) => {
    const isCompleted = missionProgress[mission.id]?.completed;
    const statusClass = isCompleted ? 'completed' : '';
    const statusText = isCompleted ? 'クリア済み' : '未クリア';
    const buttonDisabled = isCompleted ? 'disabled' : '';
    const buttonText = isCompleted ? '完了' : '開始';

    return `
      <div class="mission-select-item ${statusClass}">
        <div class="mission-select-info">
          <div class="mission-select-icon">${mission.reward.icon}</div>
          <div class="mission-select-details">
            <div class="mission-select-title">${mission.title}</div>
            <div class="mission-select-desc">${mission.description}</div>
          </div>
        </div>
        <button class="mission-select-btn ${buttonDisabled}" data-mission-id="${mission.id}" ${buttonDisabled}>
          ${buttonText}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="12" height="12">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      </div>
    `;
  }).join('');

  // Add event listeners to mission buttons
  document.querySelectorAll('.mission-select-btn').forEach(btn => {
    if (!btn.disabled) {
      btn.addEventListener('click', () => {
        const missionId = btn.dataset.missionId;
        startMission(missionId);
      });
    }
  });
}

function startMission(missionId) {
  currentMissionId = missionId;
  currentHintLevel = 1;
  showMissionDetail(missionId);
}

function showMissionDetail(missionId) {
  const mission = MISSIONS.find(m => m.id === missionId);
  if (!mission) return;

  // Update mission detail screen with mission info
  const iconEl = document.getElementById('mission-detail-icon');
  const titleEl = document.getElementById('mission-detail-title');
  const introEl = document.getElementById('mission-detail-intro');
  const objectiveEl = document.getElementById('mission-detail-objective');
  const rewardIconEl = document.getElementById('mission-reward-icon');
  const rewardNameEl = document.getElementById('mission-reward-name');

  if (iconEl) iconEl.textContent = mission.reward.icon;
  if (titleEl) titleEl.textContent = mission.title;
  if (introEl) introEl.textContent = mission.description;
  if (objectiveEl) objectiveEl.textContent = mission.hints[0].text;
  if (rewardIconEl) rewardIconEl.textContent = mission.reward.icon;
  if (rewardNameEl) rewardNameEl.textContent = mission.reward.name;

  // Show mission detail screen
  showScreen('mission-detail');
}

async function renderMissionAreasOnHomeMap() {
  // Add mission area markers to the home map using GeoJSON layer
  const [hMap] = await Promise.all([homeMap || Promise.resolve(null)]);
  if (!hMap) return;

  try {
    const nativeMap = hMap.getNativeMap?.();
    if (!nativeMap) return;
    if (!nativeMap.isStyleLoaded()) {
      // スタイル読み込み完了後にもう一度呼び直す（初回マウント直後は未ロード）
      nativeMap.once('load', renderMissionAreasOnHomeMap);
      return;
    }

    // Remove existing mission layer if present
    if (nativeMap.getLayer('mission-areas')) {
      nativeMap.removeLayer('mission-areas');
    }
    if (nativeMap.getSource('mission-areas')) {
      nativeMap.removeSource('mission-areas');
    }

    // Build GeoJSON feature collection
    const features = MISSIONS.map((mission) => {
      const isCompleted = missionProgress[mission.id]?.completed;
      return {
        type: 'Feature',
        properties: {
          id: mission.id,
          title: mission.title,
          icon: mission.reward.icon,
          completed: isCompleted,
          status: isCompleted ? 'completed' : 'available'
        },
        geometry: {
          type: 'Point',
          coordinates: [mission.targetLocation.longitude, mission.targetLocation.latitude]
        }
      };
    });

    // Add GeoJSON source
    nativeMap.addSource('mission-areas', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: features
      }
    });

    // Add layer for mission points (background circle for visibility)
    nativeMap.addLayer({
      id: 'mission-areas-bg',
      type: 'circle',
      source: 'mission-areas',
      paint: {
        'circle-radius': 18,
        'circle-color': ['case', ['==', ['get', 'status'], 'completed'], '#2E7D32', '#E8A317'],
        'circle-opacity': 1,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 3
      }
    });

    // Add layer for mission points
    nativeMap.addLayer({
      id: 'mission-areas',
      type: 'symbol',
      source: 'mission-areas',
      layout: {
        'text-field': ['get', 'icon'],
        'text-size': 18,
        'text-anchor': 'center',
        'text-offset': [0, 0],
        'text-allow-overlap': true,
        'icon-allow-overlap': true
      },
      paint: {
        'text-color': '#1C2E3A',
        'text-opacity': 1
      }
    });

    // Add click handler to both the background circle and the icon layer
    const handleMissionClick = (e) => {
      if (e.features && e.features.length > 0) {
        const feature = e.features[0];
        const missionId = feature.properties.id;
        console.log('Mission clicked:', missionId);
        startMission(missionId);
      }
    };
    nativeMap.on('click', 'mission-areas-bg', handleMissionClick);
    nativeMap.on('click', 'mission-areas', handleMissionClick);
    nativeMap.on('mouseenter', 'mission-areas-bg', () => { nativeMap.getCanvas().style.cursor = 'pointer'; });
    nativeMap.on('mouseleave', 'mission-areas-bg', () => { nativeMap.getCanvas().style.cursor = ''; });

    // Change cursor on hover
    nativeMap.on('mouseenter', 'mission-areas', () => {
      nativeMap.getCanvas().style.cursor = 'pointer';
    });
    nativeMap.on('mouseleave', 'mission-areas', () => {
      nativeMap.getCanvas().style.cursor = '';
    });

  } catch (error) {
    console.warn('Error rendering mission areas:', error);
  }
}

function updateExploreScreen() {
  if (!currentMissionId) return;

  const mission = MISSIONS.find(m => m.id === currentMissionId);
  if (!mission) return;

  // Update mission title
  const titleEl = document.getElementById('explore-mission-title');
  if (titleEl) titleEl.textContent = mission.title;

  // Update mission description
  const descEl = document.getElementById('explore-mission-desc');
  if (descEl) descEl.textContent = mission.description;

  // Update breadcrumb
  const breadcrumbEl = document.getElementById('explore-breadcrumb');
  if (breadcrumbEl) {
    const missionIndex = MISSIONS.findIndex(m => m.id === currentMissionId) + 1;
    breadcrumbEl.textContent = `MISSION ${missionIndex} / ${MISSIONS.length}`;
  }

  // Update target marker on map based on mission location
  updateTargetMarkerOnMap(mission.targetLocation.latitude, mission.targetLocation.longitude);

  // Update hints
  updateHints();
}

function updateHints() {
  if (!currentMissionId) return;

  const mission = MISSIONS.find(m => m.id === currentMissionId);
  if (!mission) return;

  const hintsContainer = document.getElementById('hints-container');
  if (!hintsContainer) return;

  // Show hints up to current level
  const visibleHints = mission.hints.filter(h => h.level <= currentHintLevel);
  hintsContainer.innerHTML = visibleHints.map(hint => `
    <div class="hint-item hint-level-${hint.level}">
      <div class="hint-level">LEVEL ${hint.level}</div>
      <div class="hint-text">${hint.text}</div>
    </div>
  `).join('');

  // Update next hint button
  const nextHintBtn = document.getElementById('next-hint-btn');
  if (nextHintBtn) {
    if (currentHintLevel >= mission.hints.length) {
      nextHintBtn.disabled = true;
      nextHintBtn.textContent = '全ヒント表示済み';
    } else {
      nextHintBtn.disabled = false;
      nextHintBtn.textContent = '次のヒント';
    }
  }
}

function showNextHint() {
  if (!currentMissionId) return;

  const mission = MISSIONS.find(m => m.id === currentMissionId);
  if (!mission || currentHintLevel >= mission.hints.length) return;

  currentHintLevel++;
  updateHints();
}

// ===================================
// Debug Mode Functions
// ===================================
function forceClear() {
  if (!debugConfig.debugMode || !debugConfig.forceClearEnabled) {
    console.log('Force clear is disabled');
    return;
  }

  if (currentMissionId) completeMission(currentMissionId);
  renderMissionSelect();
  console.log('Force clear triggered');
  showDiscovery();
}

function showAllHints() {
  if (!currentMissionId) return;
  const mission = MISSIONS.find((item) => item.id === currentMissionId);
  if (!mission) return;
  currentHintLevel = mission.hints.length;
  updateHints();
}

function simulateDebugPosition(provider, distanceMeters) {
  const mission = MISSIONS.find((item) => item.id === currentMissionId) || MISSIONS[0];
  const longitudeOffset = distanceMeters / (111320 * Math.cos(mission.targetLocation.latitude * Math.PI / 180));
  currentPosition.latitude = mission.targetLocation.latitude;
  currentPosition.longitude = mission.targetLocation.longitude + longitudeOffset;
  currentDistance = distanceMeters;
  useQZSS = provider === 'qzss';
  qzssData.position.latitude = currentPosition.latitude;
  qzssData.position.longitude = currentPosition.longitude;
  qzssData.accuracy.hdop = provider === 'qzss' ? 0.4 : 5;
  qzssData.fixQuality = provider === 'qzss' ? 3 : 2;
  qzssData.signalQuality = provider === 'qzss' ? 'excellent' : 'good';
  syncPositionToMaps();
  updateDistanceFromTarget();
  updateDebugUI();
}

function setDebugPositionFromMap(lat, lng) {
  if (!debugConfig.debugMode || !Number.isFinite(lat) || !Number.isFinite(lng)) return;

  const mission = MISSIONS.find((item) => item.id === currentMissionId) || MISSIONS[0];
  currentPosition.latitude = lat;
  currentPosition.longitude = lng;
  currentDistance = calculateDistance(lat, lng, mission.targetLocation.latitude, mission.targetLocation.longitude);
  useQZSS = false;
  qzssData.position.latitude = lat;
  qzssData.position.longitude = lng;
  qzssData.accuracy.hdop = 0.7;
  qzssData.fixQuality = 3;
  qzssData.signalQuality = 'good';
  qzssData.timestamp = Date.now();
  syncPositionToMaps();
  updateDistanceFromTarget();
  updateDebugUI();
}

function attachDebugMapClickHandler() {
  const activeMap = exploreMap || homeMap;
  const nativeMap = activeMap?.getNativeMap?.();
  if (!nativeMap || nativeMap.__geoDebugClickBound) return;

  nativeMap.on('click', (event) => {
    if (!debugConfig.debugMode) return;
    setDebugPositionFromMap(event.lngLat.lat, event.lngLat.lng);
  });

  nativeMap.__geoDebugClickBound = true;
}

function resetMissions() {
  missionProgress = {};
  collection = [];
  localStorage.removeItem('geopuzzle_mission_progress');
  localStorage.removeItem('geopuzzle_collection');
  currentMissionId = null;
  currentHintLevel = 1;
  renderMissionSelect();
  updateStats();
  closeDiscovery();
}

function clearAllMissions() {
  MISSIONS.forEach((mission) => {
    missionProgress[mission.id] = { completed: true, completedAt: new Date().toISOString() };
    if (!collection.includes(mission.id)) collection.push(mission.id);
  });
  localStorage.setItem('geopuzzle_mission_progress', JSON.stringify(missionProgress));
  localStorage.setItem('geopuzzle_collection', JSON.stringify(collection));
  renderMissionSelect();
  updateStats();
}

function toggleDebugPanel() {
  const panel = document.getElementById('debug-panel');
  if (panel) {
    panel.classList.toggle('hidden');
  }
}

function updateDebugUI() {
  if (!debugConfig.debugMode) {
    const debugPanel = document.getElementById('debug-panel');
    if (debugPanel) {
      debugPanel.classList.add('hidden');
    }
    return;
  }

  // Update debug info
  const debugModeStatus = document.getElementById('debug-mode-status');
  if (debugModeStatus) {
    debugModeStatus.textContent = debugConfig.debugMode ? '有効' : '無効';
    debugModeStatus.style.color = debugConfig.debugMode ? '#4CAF50' : '#999';
  }

  const currentDistanceDebug = document.getElementById('debug-distance');
  if (currentDistanceDebug) {
    currentDistanceDebug.textContent = currentDistance + 'm';
  }

  const qzssStatus = document.getElementById('qzss-status');
  if (qzssStatus) {
    const state = getUserPositionConnectionState();
    qzssStatus.textContent = state.statusText;
    qzssStatus.style.color = state.shouldShowUserPosition ? '#4CAF50' : '#F44336';
  }

  const currentPositionDebug = document.getElementById('debug-position');
  if (currentPositionDebug) {
    if (currentPosition.latitude && currentPosition.longitude) {
      currentPositionDebug.textContent = `${currentPosition.latitude.toFixed(6)}, ${currentPosition.longitude.toFixed(6)}`;
    } else {
      currentPositionDebug.textContent = '位置情報なし';
    }
  }
}

// ===================================
// Web Serial API Functions
// ===================================
async function connectSerialPort() {
  try {
    // Check if Web Serial API is supported
    if (!navigator.serial) {
      alert('Web Serial APIはこのブラウザでサポートされていません。ChromeまたはEdgeを使用してください。');
      return;
    }

    // Request port from user
    serialPort = await navigator.serial.requestPort();

    // Open port with QZ1 default baud rate
    await serialPort.open({ baudRate: 115200 });

    isConnected = true;
    useQZSS = true;
    updateSerialConnectionUI();

    // Start reading data
    readSerialData();

    // Start periodic status check
    startStatusCheck();

    console.log('Serial port connected successfully');
  } catch (error) {
    console.error('Serial port connection failed:', error);
    alert('シリアルポートの接続に失敗しました: ' + error.message);
  }
}

async function disconnectSerialPort() {
  try {
    // Stop periodic status check
    stopStatusCheck();

    if (serialReader) {
      await serialReader.cancel();
      serialReader = null;
    }

    if (serialPort) {
      await serialPort.close();
      serialPort = null;
    }

    isConnected = false;
    useQZSS = false;
    currentPosition = { latitude: null, longitude: null };
    qzssData.position = { latitude: null, longitude: null, altitude: null };
    updateSerialConnectionUI();
    syncPositionToMaps();

    // Reset signal quality
    qzssData.signalQuality = 'none';
    updateQZSSUI();

    console.log('Serial port disconnected');
  } catch (error) {
    console.error('Serial port disconnection failed:', error);
  }
}

function startStatusCheck() {
  // Check signal quality every 5 seconds
  statusCheckInterval = setInterval(() => {
    if (isConnected) {
      checkPositionValidity();
      updateQZSSUI();
    }
  }, 5000);
}

function stopStatusCheck() {
  if (statusCheckInterval) {
    clearInterval(statusCheckInterval);
    statusCheckInterval = null;
  }
}

async function readSerialData() {
  while (serialPort && serialPort.readable) {
    serialReader = serialPort.readable.getReader();
    try {
      while (true) {
        const { value, done } = await serialReader.read();
        if (done) {
          break;
        }

        // Convert received data to string and process NMEA sentences
        const text = new TextDecoder().decode(value);
        processNMEAData(text);
      }
    } catch (error) {
      console.error('Serial read error:', error);
    } finally {
      serialReader.releaseLock();
    }
  }
}

function processNMEAData(data) {
  // Split data into lines and process each NMEA sentence
  const lines = data.split('\n');
  lines.forEach(line => {
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith('$') && trimmedLine.length > 0) {
      parseNMEASentence(trimmedLine);
    }
  });
}

function parseNMEASentence(sentence) {
  // Parse NMEA-0183 sentences with extended QZSS support
  // Example: $GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*47

  const result = { position: null, accuracy: null, satellites: null };

  if (sentence.startsWith('$GPGGA') || sentence.startsWith('$GNGGA')) {
    // GGA sentence contains position data with accuracy info
    const parts = sentence.split(',');
    if (parts.length >= 15) {
      const time = parts[1];
      const lat = parseNMEACoordinate(parts[2], parts[3]);
      const lon = parseNMEACoordinate(parts[4], parts[5]);
      const fixQuality = parseInt(parts[6]);
      const satellitesUsed = parseInt(parts[7]);
      const hdop = parseFloat(parts[8]);
      const altitude = parseFloat(parts[9]);

      if (lat && lon) {
        result.position = { latitude: lat, longitude: lon, altitude };
        result.accuracy = { hdop };
        result.satellites = { used: satellitesUsed };
        result.fixQuality = fixQuality;

        // Update global state
        currentPosition = { latitude: lat, longitude: lon };
        qzssData.position = { latitude: lat, longitude: lon, altitude };
        qzssData.accuracy = { hdop, pdop: null, vdop: null };
        qzssData.satellites.used = satellitesUsed;
        qzssData.fixQuality = fixQuality;
        qzssData.timestamp = Date.now();

        // Evaluate signal quality
        evaluateSignalQuality();

        updateDistanceFromTarget();
        updatePlayerMarkerOnMap(lat, lon); // Update map marker
        updateQZSSUI();
        console.log('Position updated:', currentPosition, 'QZSS data:', qzssData);
      }
    }
  } else if (sentence.startsWith('$GPRMC') || sentence.startsWith('$GNRMC')) {
    // RMC sentence also contains position data
    const parts = sentence.split(',');
    if (parts.length >= 6) {
      const lat = parseNMEACoordinate(parts[3], parts[4]);
      const lon = parseNMEACoordinate(parts[5], parts[6]);

      if (lat && lon) {
        result.position = { latitude: lat, longitude: lon };

        // Update global state
        currentPosition = { latitude: lat, longitude: lon };
        qzssData.position = { latitude: lat, longitude: lon };
        qzssData.timestamp = Date.now();

        // Evaluate signal quality
        evaluateSignalQuality();

        updateDistanceFromTarget();
        updatePlayerMarkerOnMap(lat, lon); // Update map marker
        updateQZSSUI();
        console.log('Position updated:', currentPosition);
      }
    }
  } else if (sentence.startsWith('$GPGSA') || sentence.startsWith('$GNGSA') || sentence.startsWith('$QZQSA')) {
    // GSA sentence contains DOP values and active satellites
    const parts = sentence.split(',');
    if (parts.length >= 18) {
      const mode = parts[1];
      const fixType = parseInt(parts[2]);
      const pdop = parseFloat(parts[15]);
      const hdop = parseFloat(parts[16]);
      const vdop = parseFloat(parts[17]);

      result.accuracy = { pdop, hdop, vdop };

      // Update global state
      qzssData.accuracy = { pdop, hdop, vdop };
      evaluateSignalQuality();
      updateQZSSUI();
      console.log('Accuracy updated:', result.accuracy);
    }
  } else if (sentence.startsWith('$GPGSV') || sentence.startsWith('$GNGSV') || sentence.startsWith('$QZGSV')) {
    // GSV sentence contains satellite information
    const parts = sentence.split(',');
    if (parts.length >= 4) {
      const totalMessages = parseInt(parts[1]);
      const messageNumber = parseInt(parts[2]);
      const totalSatellites = parseInt(parts[3]);

      // Parse satellite details (4 satellites per message)
      const satelliteDetails = [];
      for (let i = 4; i < parts.length - 1; i += 4) {
        if (parts[i] && parts[i+1] && parts[i+2] && parts[i+3]) {
          satelliteDetails.push({
            prn: parseInt(parts[i]),
            elevation: parseInt(parts[i+1]),
            azimuth: parseInt(parts[i+2]),
            snr: parseInt(parts[i+3])
          });
        }
      }

      result.satellites = {
        total: totalSatellites,
        details: satelliteDetails
      };

      // Update global state
      qzssData.satellites.total = totalSatellites;
      qzssData.satellites.details = [...qzssData.satellites.details, ...satelliteDetails];

      // Count by constellation based on PRN ranges
      qzssData.satellites.gps = qzssData.satellites.details.filter(s => s.prn >= 1 && s.prn <= 32).length;
      qzssData.satellites.qzss = qzssData.satellites.details.filter(s => s.prn >= 193 && s.prn <= 202).length;
      qzssData.satellites.glonass = qzssData.satellites.details.filter(s => s.prn >= 65 && s.prn <= 96).length;

      evaluateSignalQuality();
      updateQZSSUI();
      console.log('Satellites updated:', result.satellites);
    }
  }

  return result;
}

function evaluateSignalQuality() {
  const satellites = qzssData.satellites.total;
  const hdop = qzssData.accuracy.hdop;
  const fixQuality = qzssData.fixQuality;

  // Signal quality evaluation based on satellites and HDOP
  if (satellites >= 8 && hdop && hdop < 2.0 && fixQuality >= 2) {
    qzssData.signalQuality = 'excellent';
  } else if (satellites >= 5 && hdop && hdop < 5.0 && fixQuality >= 2) {
    qzssData.signalQuality = 'good';
  } else if (satellites >= 3 && fixQuality >= 1) {
    qzssData.signalQuality = 'poor';
  } else {
    qzssData.signalQuality = 'none';
  }

  console.log('Signal quality:', qzssData.signalQuality);
}

function checkPositionValidity() {
  // Check if position data is recent and valid
  const now = Date.now();
  const timeSinceLastUpdate = qzssData.timestamp ? (now - qzssData.timestamp) : Infinity;

  // If no position data for more than 10 seconds, consider it invalid
  if (timeSinceLastUpdate > 10000) {
    qzssData.signalQuality = 'none';
    return false;
  }

  // Check if position data is reasonable
  if (!qzssData.position.latitude || !qzssData.position.longitude) {
    qzssData.signalQuality = 'none';
    return false;
  }

  // Check if position is within reasonable bounds
  const lat = qzssData.position.latitude;
  const lon = qzssData.position.longitude;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    qzssData.signalQuality = 'none';
    return false;
  }

  return true;
}

function parseNMEACoordinate(coord, direction) {
  if (!coord || !direction) return null;

  // NMEA coordinate format: DDMM.MMMM or DDDMM.MMMM
  const degrees = Math.floor(parseFloat(coord) / 100);
  const minutes = parseFloat(coord) - (degrees * 100);
  const decimal = degrees + (minutes / 60);

  // Apply direction (N/S for latitude, E/W for longitude)
  if (direction === 'S' || direction === 'W') {
    return -decimal;
  }
  return decimal;
}

function updateDistanceFromTarget() {
  if (!currentMissionId || !currentPosition.latitude || !currentPosition.longitude) return;

  const mission = MISSIONS.find(m => m.id === currentMissionId);
  if (!mission) return;

  const target = mission.targetLocation;
  const distance = calculateDistance(
    currentPosition.latitude,
    currentPosition.longitude,
    target.latitude,
    target.longitude
  );

  // Determine navigation mode based on distance
  currentNavMode = determineNavMode(distance);

  // Update UI based on navigation mode
  updateNavigationUI(distance, currentNavMode);

  // Update debug UI
  if (debugConfig.debugMode) {
    updateDebugUI();
  }
}

function determineNavMode(distance) {
  if (distance > 100) return NAV_MODES.DIRECTION;
  if (distance > 30) return NAV_MODES.PRECISE;
  if (distance > 10) return NAV_MODES.EXPLORATION;
  if (distance > 3) return NAV_MODES.FINAL;
  return NAV_MODES.QZSS;
}

function updateNavigationUI(distance, mode) {
  const distEl = document.getElementById('explore-distance');
  const directionEl = document.getElementById('explore-direction');
  const guidanceEl = document.getElementById('explore-guidance');
  const radarOverlay = document.getElementById('radar-overlay');
  const clueDistanceSection = document.querySelector('.clue-distance-section');

  if (!distEl) return;

  const roundedDistance = Math.round(distance);
  const directionText = getDirectionText();

  switch (mode) {
    case NAV_MODES.DIRECTION:
      distEl.textContent = roundedDistance;
      if (directionEl) directionEl.textContent = directionText ? `${directionText} へ進む` : '方向を確認';
      if (guidanceEl) guidanceEl.textContent = '目的地の方向へ進もう';
      if (radarOverlay) radarOverlay.style.display = 'block';
      if (clueDistanceSection) clueDistanceSection.classList.remove('is-searching', 'is-close');
      updateRadar(distance);
      break;
    case NAV_MODES.PRECISE:
      distEl.textContent = roundedDistance;
      if (directionEl) directionEl.textContent = directionText ? `${directionText} へ近づいています` : '方向を確認';
      if (guidanceEl) guidanceEl.textContent = '近づいています。正しい方向に進んでいます';
      if (radarOverlay) radarOverlay.style.display = 'block';
      if (clueDistanceSection) clueDistanceSection.classList.remove('is-searching', 'is-close');
      updateRadar(distance);
      break;
    case NAV_MODES.EXPLORATION:
      distEl.textContent = '—';
      if (directionEl) directionEl.textContent = 'この近くにあります';
      if (guidanceEl) guidanceEl.textContent = '周囲を見渡して、探してみよう';
      if (radarOverlay) radarOverlay.style.display = 'none';
      if (clueDistanceSection) {
        clueDistanceSection.classList.add('is-searching');
        clueDistanceSection.classList.remove('is-close');
      }
      break;
    case NAV_MODES.FINAL:
      distEl.textContent = '—';
      if (directionEl) directionEl.textContent = 'かなり近いです';
      if (guidanceEl) guidanceEl.textContent = '最後の数mを自分で探してみよう';
      if (radarOverlay) radarOverlay.style.display = 'none';
      if (clueDistanceSection) {
        clueDistanceSection.classList.add('is-searching', 'is-close');
      }
      break;
    case NAV_MODES.QZSS:
      distEl.textContent = '—';
      if (directionEl) directionEl.textContent = 'ここにあります';
      if (guidanceEl) guidanceEl.textContent = '周囲を見て、見つけてみよう';
      if (radarOverlay) radarOverlay.style.display = 'none';
      if (clueDistanceSection) {
        clueDistanceSection.classList.add('is-searching', 'is-close');
      }
      break;
  }
}

function updateRadar(distance) {
  const radarTarget = document.getElementById('radar-target');
  const radarDistance = document.getElementById('radar-distance');
  
  if (!radarTarget || !radarDistance) return;

  // Calculate radar target position based on direction
  const mission = MISSIONS.find(m => m.id === currentMissionId);
  if (!mission || !currentPosition.latitude || !currentPosition.longitude) return;

  const target = mission.targetLocation;
  const dy = target.latitude - currentPosition.latitude;
  const dx = target.longitude - currentPosition.longitude;
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;

  // Position radar target based on angle
  const radius = 40; // pixels from center
  const radian = (angle - 90) * Math.PI / 180; // Adjust for CSS coordinate system
  const x = 60 + radius * Math.cos(radian);
  const y = 60 + radius * Math.sin(radian);

  radarTarget.style.left = `${x}px`;
  radarTarget.style.top = `${y}px`;
  
  // Update distance display
  radarDistance.textContent = `${Math.round(distance)}m`;
}

function getDirectionText() {
  if (!currentMissionId || !currentPosition.latitude || !currentPosition.longitude) return '---';

  const mission = MISSIONS.find(m => m.id === currentMissionId);
  if (!mission) return '---';

  const target = mission.targetLocation;
  const dy = target.latitude - currentPosition.latitude;
  const dx = target.longitude - currentPosition.longitude;

  // Calculate direction
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  const directions = ['北', '北東', '東', '南東', '南', '南西', '西', '北西'];
  const index = Math.round(((angle + 360) % 360) / 45) % 8;

  return directions[index];
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  // Haversine formula for calculating distance between two coordinates
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}

function updateSerialConnectionUI() {
  const statusEl = document.getElementById('serial-status');
  const connectBtn = document.getElementById('connect-serial-btn');
  const disconnectBtn = document.getElementById('disconnect-serial-btn');
  const connectionState = getUserPositionConnectionState();

  if (statusEl) {
    statusEl.textContent = connectionState.statusText;
    statusEl.classList.toggle('connected', connectionState.shouldShowUserPosition);
    statusEl.classList.toggle('disconnected', !connectionState.shouldShowUserPosition);
  }

  if (connectBtn) {
    connectBtn.style.display = isConnected ? 'none' : 'flex';
  }

  if (disconnectBtn) {
    disconnectBtn.style.display = isConnected ? 'flex' : 'none';
  }

  // Update debug panel
  if (debugConfig.debugMode) {
    const qzssStatus = document.getElementById('qzss-status');
    if (qzssStatus) {
      qzssStatus.textContent = connectionState.statusText;
      qzssStatus.style.color = connectionState.shouldShowUserPosition ? '#4CAF50' : '#F44336';
    }
  }
}

// ===================================
// QZSS UI Update Functions
// ===================================
function updateQZSSUI() {
  // Check position validity
  const isPositionValid = checkPositionValidity();

  // Update accuracy display
  const accuracyEl = document.getElementById('gps-accuracy');
  if (accuracyEl) {
    if (!isPositionValid || qzssData.signalQuality === 'none') {
      accuracyEl.textContent = '信号なし';
      accuracyEl.style.color = '#F44336';
    } else if (qzssData.accuracy.hdop) {
      const accuracy = qzssData.accuracy.hdop * 5; // HDOP to meters approximation
      accuracyEl.textContent = `精度: ±${accuracy.toFixed(1)}m`;

      // Color based on accuracy (QZSS can achieve centimeter-level)
      if (accuracy < 0.1) {
        accuracyEl.style.color = '#4CAF50'; // Centimeter-level
      } else if (accuracy < 1.0) {
        accuracyEl.style.color = '#8BC34A'; // Sub-meter
      } else if (accuracy < 5.0) {
        accuracyEl.style.color = '#FFC107'; // Meter-level
      } else {
        accuracyEl.style.color = '#F44336'; // Low accuracy
      }
    }
  }

  // Update satellite count
  const satCountEl = document.getElementById('satellite-count');
  if (satCountEl) {
    if (!isPositionValid || qzssData.signalQuality === 'none') {
      satCountEl.textContent = '受信不可';
    } else {
      satCountEl.textContent = `${qzssData.satellites.total}衛星 (GPS:${qzssData.satellites.gps}, QZSS:${qzssData.satellites.qzss})`;
    }
  }

  // Update reception status
  const receptionEl = document.getElementById('reception-status');
  if (receptionEl) {
    if (!isConnected || !isPositionValid || qzssData.signalQuality === 'none') {
      receptionEl.textContent = '未接続: 位置情報なし';
      receptionEl.style.color = '#F44336';
    } else if (qzssData.fixQuality === 1) {
      receptionEl.textContent = 'GPSのみ';
      receptionEl.style.color = '#FFC107';
    } else if (qzssData.fixQuality === 2) {
      receptionEl.textContent = '2D測位';
      receptionEl.style.color = '#4CAF50';
    } else if (qzssData.fixQuality >= 3) {
      receptionEl.textContent = '3D測位 (QZSS補正)';
      receptionEl.style.color = '#2196F3';
    } else {
      receptionEl.textContent = '測位不可';
      receptionEl.style.color = '#F44336';
    }
  }

  // Update signal quality indicator
  const signalQualityEl = document.getElementById('signal-quality');
  if (signalQualityEl) {
    switch (qzssData.signalQuality) {
      case 'excellent':
        signalQualityEl.textContent = '● 受信良好';
        signalQualityEl.style.color = '#4CAF50';
        break;
      case 'good':
        signalQualityEl.textContent = '● 受信良好';
        signalQualityEl.style.color = '#8BC34A';
        break;
      case 'poor':
        signalQualityEl.textContent = '● 受信不良';
        signalQualityEl.style.color = '#FFC107';
        break;
      case 'none':
        signalQualityEl.textContent = '● 信号なし';
        signalQualityEl.style.color = '#F44336';
        break;
      default:
        signalQualityEl.textContent = '● 不明';
        signalQualityEl.style.color = '#999';
    }
  }

  // Update debug panel with QZSS data
  if (debugConfig.debugMode) {
    updateDebugQZSSInfo();
  }
}

function updateDebugQZSSInfo() {
  const debugPosition = document.getElementById('debug-position');
  if (debugPosition && qzssData.position.latitude && qzssData.position.longitude) {
    debugPosition.textContent = `${qzssData.position.latitude.toFixed(6)}, ${qzssData.position.longitude.toFixed(6)}`;
  }

  const debugAccuracy = document.getElementById('debug-accuracy');
  if (debugAccuracy && qzssData.accuracy.hdop) {
    debugAccuracy.textContent = `HDOP: ${qzssData.accuracy.hdop.toFixed(2)}`;
  }

  const debugSatellites = document.getElementById('debug-satellites');
  if (debugSatellites) {
    debugSatellites.textContent = `Total: ${qzssData.satellites.total}, QZSS: ${qzssData.satellites.qzss}`;
  }
}