/* ===================================
   GeoPuzzle App Logic
   =================================== */

// ===================================
// State
// ===================================
let currentUser = { id: 'demo', name: 'k', email: 'k.kyogaku.123@gmail.com' };
let currentScreen = 'home';
let collection = JSON.parse(localStorage.getItem('geopuzzle_collection') || '[]');

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

  // Discovery overlay buttons
  const addCollectionBtn = document.getElementById('add-collection-btn');
  if (addCollectionBtn) {
    addCollectionBtn.addEventListener('click', () => {
      addToCollection('akagi');
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
    showDiscovery();
  }, 1000);
}

// ===================================
// Discovery Overlay
// ===================================
function showDiscovery() {
  const overlay = document.getElementById('discovery-overlay');
  if (overlay) {
    overlay.classList.remove('hidden');
    overlay.style.display = 'flex';
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
