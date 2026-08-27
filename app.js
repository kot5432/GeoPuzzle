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

// Debug Mode Configuration
const debugConfig = {
  debugMode: true,  // 開発時はtrue、本番時はfalse
  forceClearEnabled: true  // 強制クリア機能の有効化
};

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

// Mission data structure
const MISSIONS = [
  {
    id: "mission1",
    title: "展望広場からの絶景",
    description: "富山湾、立山連峰、新湊大橋、帆船海王丸が一望できる場所を探そう",
    targetLocation: {
      latitude: 36.7777,  // 仮座標（フィールドワークで確定）
      longitude: 137.1234,
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
      latitude: 36.7778,  // 仮座標（フィールドワークで確定）
      longitude: 137.1235,
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
      latitude: 36.7779,  // 仮座標（フィールドワークで確定）
      longitude: 137.1236,
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
  if (name === 'home') renderMissionSelect();
}

// ===================================
// Init
// ===================================
document.addEventListener('DOMContentLoaded', () => {
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
let currentDistance = 86;

function startDistanceAnimation() {
  // Gently oscillate distance to simulate movement
  setInterval(() => {
    const delta = Math.floor(Math.random() * 7) - 3;
    currentDistance = Math.max(10, currentDistance + delta);
    const distEl = document.getElementById('explore-distance');
    if (distEl) distEl.textContent = currentDistance;

    // Update debug UI if in debug mode
    if (debugConfig.debugMode) {
      updateDebugUI();
    }
  }, 3000);
}

function simulateLocationUpdate() {
  const btn = document.getElementById('update-location-btn');
  if (!btn) return;

  btn.textContent = '更新中...';
  btn.disabled = true;

  setTimeout(() => {
    // Decrease distance to simulate approach
    currentDistance = Math.max(15, currentDistance - Math.floor(Math.random() * 20 + 5));
    const distEl = document.getElementById('explore-distance');
    if (distEl) distEl.textContent = currentDistance;

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
  // MVP: always succeeds after a moment
  const btn = document.getElementById('check-arrive-btn');
  if (btn) {
    btn.textContent = '判定中...';
    btn.disabled = true;
  }

  setTimeout(() => {
    if (btn) {
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        到着判定
      `;
      btn.disabled = false;
    }

    // Mark mission as completed
    if (currentMissionId) {
      completeMission(currentMissionId);
    }

    showDiscovery();
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
  updateExploreScreen();
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
