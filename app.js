/* ===================================
   GeoPuzzle App Logic
   =================================== */

// ===================================
// State
// ===================================
let currentUser = { id: 'demo', name: 'k', email: 'k.kyogaku.123@gmail.com' };
let currentScreen = 'home';
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

// Google Maps (GeoMap コンポーネントの Promise を保持)
let homeMap = null;
let exploreMap = null;

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
  timestamp: null
};

// Map Configuration for GeoPuzzle (Leaflet)
const MAP_CONFIG = {
  center: {
    lat: 36.7813,  // 海王丸パーク中心
    lng: 137.1076
  },
  zoom: 16
};

// Mission data structure
const MISSIONS = [
  {
    id: "mission1",
    title: "展望広場からの絶景",
    description: "富山湾、立山連峰、新湊大橋、帆船海王丸が一望できる場所を探そう",
    targetLocation: {
      latitude: 36.7813,  // 海王丸パーク展望広場の実際の座標
      longitude: 137.1076,
      tolerance: 0.5  // 50cm（みちびき受信機）
    },
    hints: [
      { level: 1, text: "海王丸が見える場所を探そう" },
      { level: 2, text: "展望広場の方へ進んでみよう" },
      { level: 3, text: "富山湾が見えてきた" },
      { level: 4, text: "最も眺めが良い場所に立ってみよう" }
    ],
    reward: {
      type: "stamp",
      name: "絶景発見者",
      icon: "🏔️"
    }
  },
  {
    id: "mission2",
    title: "幸せのベルを鳴らす場所",
    description: "海王丸船内のタイムベル（幸せのベル）の前で幸せを願おう",
    targetLocation: {
      latitude: 36.7812,  // 海王丸船内の実際の座標
      longitude: 137.1075,
      tolerance: 0.5  // 50cm（みちびき受信機）
    },
    hints: [
      { level: 1, text: "海王丸の船内に入ろう" },
      { level: 2, text: "タイムベルを探してみよう" },
      { level: 3, text: "ベルの前に立とう" },
      { level: 4, text: "幸せのベルを鳴らそう" }
    ],
    reward: {
      type: "stamp",
      name: "幸せの鐘",
      icon: "🔔"
    }
  },
  {
    id: "mission3",
    title: "恋人の聖地記念モニュメント",
    description: "2013年に「恋人の聖地」に選定された特別な場所を探そう",
    targetLocation: {
      latitude: 36.7811,  // 恋人の聖地モニュメントの実際の座標
      longitude: 137.1074,
      tolerance: 0.5  // 50cm（みちびき受信機）
    },
    hints: [
      { level: 1, text: "恋人の聖地マークを探そう" },
      { level: 2, text: "記念モニュメントの方へ進もう" },
      { level: 3, text: "愛の場所の雰囲気を感じよう" },
      { level: 4, text: "記念モニュメントの前に立とう" }
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

function ensureMapsMounted() {
  if (homeMap && exploreMap) {
    return Promise.all([homeMap, exploreMap]).then(() => {});
  }

  const center = {
    lat: MAP_CONFIG.center.lat,
    lng: MAP_CONFIG.center.lng,
  };

  if (!homeMap) {
    homeMap = (typeof GeoMap !== 'undefined' && GeoMap.mount)
      ? GeoMap.mount('#home-map-container', { center, zoom: 16 }).catch(err => {
          console.warn('[homeMap] mount failed:', err?.message);
          return null;
        })
      : Promise.resolve(null);
  }
  if (!exploreMap) {
    exploreMap = (typeof GeoMap !== 'undefined' && GeoMap.mount)
      ? GeoMap.mount('#explore-map-container', { center, zoom: 17 }).catch(err => {
          console.warn('[exploreMap] mount failed:', err?.message);
          return null;
        })
      : Promise.resolve(null);
  }
  return Promise.all([homeMap, exploreMap]).then(() => {
    syncTargetsToHomeMap();
    if (currentMissionId) syncTargetsToExploreMap();
    syncPositionToMaps();
  });
}

async function syncPositionToMaps() {
  if (!currentPosition?.latitude || !currentPosition?.longitude) return;

  const [hMap, eMap] = await Promise.all([
    homeMap || Promise.resolve(null),
    exploreMap || Promise.resolve(null),
  ]);

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
  if (!hMap || !hMap.setTargets) return;
  const palette = ['#E05C35', '#F4C542', '#7E57C2'];
  hMap.setTargets(MISSIONS.map((m, i) => ({
    id: m.id,
    position: { lat: m.targetLocation.latitude, lng: m.targetLocation.longitude },
    radius: m.targetLocation.tolerance || 0.5,
    color: palette[i % palette.length],
    title: m.title,
    fillOpacity: 0.15,
  })));
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

  // Update nav active state
  NAV_IDS.forEach((navId) => {
    const btn = document.getElementById(navId);
    if (!btn) return;
    const screen = btn.dataset.screen;
    btn.classList.toggle('active', screen === name);
  });

  currentScreen = name;

  // Screen-specific actions
  if (name === 'record') renderDiscoveryList();
  if (name === 'home') {
    renderMissionSelect();
    ensureMapsMounted();
  }
  if (name === 'explore') {
    ensureMapsMounted();
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

  // Start distance counter animation on explore screen
  startDistanceAnimation();

  // Debug mode controls
  if (debugConfig.debugMode) {
    const forceClearBtn = document.getElementById('force-clear-btn');
    if (forceClearBtn) {
      forceClearBtn.addEventListener('click', forceClear);
    }

    const toggleDebugBtn = document.getElementById('toggle-debug-btn');
    if (toggleDebugBtn) {
      toggleDebugBtn.addEventListener('click', toggleDebugPanel);
    }

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
        if (titleEl) titleEl.textContent = mission.title;
        if (messageEl) messageEl.textContent = mission.description;
        if (rewardEl) rewardEl.textContent = mission.reward.name;
      }
    }
  }
}

function closeDiscovery() {
  const overlay = document.getElementById('discovery-overlay');
  if (overlay) {
    overlay.classList.add('hidden');
    overlay.style.display = 'none';
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

  // Merge saved collection with demo spots
  const toShow = collection.length > 0
    ? SPOTS.filter((s) => collection.includes(s.id))
    : SPOTS; // show demo data even before discovering

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
  showScreen('explore');
  ensureMapsMounted().then(() => {
    updateExploreScreen();
  });
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

  console.log('Force clear triggered');
  showDiscovery();
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
    qzssStatus.textContent = isConnected ? '接続中' : '未接続';
    qzssStatus.style.color = isConnected ? '#4CAF50' : '#999';
  }

  const currentPositionDebug = document.getElementById('debug-position');
  if (currentPositionDebug && currentPosition.latitude && currentPosition.longitude) {
    currentPositionDebug.textContent = `${currentPosition.latitude.toFixed(6)}, ${currentPosition.longitude.toFixed(6)}`;
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

    console.log('Serial port connected successfully');
  } catch (error) {
    console.error('Serial port connection failed:', error);
    alert('シリアルポートの接続に失敗しました: ' + error.message);
  }
}

async function disconnectSerialPort() {
  try {
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
    updateSerialConnectionUI();

    console.log('Serial port disconnected');
  } catch (error) {
    console.error('Serial port disconnection failed:', error);
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

      updateQZSSUI();
      console.log('Satellites updated:', result.satellites);
    }
  }

  return result;
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

  // Update distance display
  const distEl = document.getElementById('explore-distance');
  if (distEl) {
    distEl.textContent = Math.round(distance);
  }

  // Update debug UI
  if (debugConfig.debugMode) {
    updateDebugUI();
  }
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

  if (statusEl) {
    statusEl.textContent = isConnected ? '接続中' : '未接続';
    statusEl.classList.toggle('connected', isConnected);
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
      qzssStatus.textContent = isConnected ? '接続中' : '未接続';
      qzssStatus.style.color = isConnected ? '#4CAF50' : '#999';
    }
  }
}

// ===================================
// QZSS UI Update Functions
// ===================================
function updateQZSSUI() {
  // Update accuracy display
  const accuracyEl = document.getElementById('gps-accuracy');
  if (accuracyEl && qzssData.accuracy.hdop) {
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

  // Update satellite count
  const satCountEl = document.getElementById('satellite-count');
  if (satCountEl) {
    satCountEl.textContent = `${qzssData.satellites.total}衛星 (GPS:${qzssData.satellites.gps}, QZSS:${qzssData.satellites.qzss})`;
  }

  // Update reception status
  const receptionEl = document.getElementById('reception-status');
  if (receptionEl) {
    if (qzssData.fixQuality === 1) {
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