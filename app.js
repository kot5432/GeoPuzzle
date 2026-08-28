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
let currentDistance = null;
let simulatedDistance = 86;
let approachStuckSince = null;

const MISSIONS = [
  {
    id: 'mission1',
    spotType: 'pinpoint',
    title: '展望広場からの絶景',
    description: '富山湾、立山連峰、新湊大橋、帆船海王丸が一望できる場所を探そう',
    targetLocation: {
      latitude: 36.7777,
      longitude: 137.1234,
      tolerance: 0.5,
      gpsTolerance: 5.0,
    },
    hints: [
      { level: 1, text: '海王丸が見える場所を探そう' },
      { level: 2, text: '展望広場の方へ進んでみよう' },
      { level: 3, text: '富山湾が見えてきた' },
      { level: 4, text: '最も眺めが良い場所に立ってみよう' },
    ],
    discoveryContent: {
      summary: 'ここは海王丸パーク展望広場のベストスポット。天気が良ければ富山湾越しに立山連峰の雪解けした山肌が見渡せ、手前には帆船海王丸のマスト、右奥には新湊大橋のアーチが同時にフレームに収まります。',
      trivia: [
        '展望広場はパーク内で最も標高が高いエリアです',
        '晴れた早朝には富山湾に御来光が反射する絶景が有名です',
        '地元カメラマンの間では「夕暮れ15分前」が撮影のゴールデンタイムと言われています',
      ],
      localStory: '地元の若いカップルの間では、「この場所でプロポーズすると結婚がうまくいく」というささやかなジンクスがあるそうです。',
      photoTip: '海王丸のマストを左下に、新湊大橋を右上に配置すると、四つの要素（海・山・橋・船）が一枚に収まる名作ショットになります。',
    },
    reward: { type: 'stamp', name: '絶景発見者', icon: '🏔️' },
  },
  {
    id: 'mission2',
    spotType: 'pinpoint',
    title: '幸せのベルを鳴らす場所',
    description: '海王丸船内のタイムベル（幸せのベル）の前で幸せを願おう',
    targetLocation: {
      latitude: 36.7778,
      longitude: 137.1235,
      tolerance: 0.5,
      gpsTolerance: 5.0,
    },
    hints: [
      { level: 1, text: '海王丸の船内に入ろう' },
      { level: 2, text: 'タイムベルを探してみよう' },
      { level: 3, text: 'ベルの前に立とう' },
      { level: 4, text: '幸せのベルを鳴らそう' },
    ],
    discoveryContent: {
      summary: '海王丸の船内に残されたタイムベル。もともとは航海中の時間を知らせるための重要な装備でしたが、現在は「幸せのベル」として来訪者が鳴らすことができます。',
      trivia: [
        'タイムベルは本来、30分ごとに鳴らされて船員の生活リズムを刻んでいました',
        'ベルを鳴らす回数には決まりがあり、偶数回が幸せを呼ぶと言われています',
        '船内見学ルートの終盤に位置しているため、見逃しやすい隠れスポットです',
      ],
      localStory: '船の修繕を担当していた職人さんが「何十年も経ってもこのベルだけはずっと良い音を鳴らす」と話していたと、現在地元ガイドの方に教えていただきました。',
      photoTip: 'ベルを鳴らす瞬間を連写で撮ると、真鍮製のベルに反射する光と表情が一緒に残せて思い出になります。',
    },
    reward: { type: 'stamp', name: '幸せの鐘', icon: '🔔' },
  },
  {
    id: 'mission3',
    spotType: 'pinpoint',
    title: '恋人の聖地記念モニュメント',
    description: '2013年に「恋人の聖地」に選定された特別な場所を探そう',
    targetLocation: {
      latitude: 36.7779,
      longitude: 137.1236,
      tolerance: 0.5,
      gpsTolerance: 5.0,
    },
    hints: [
      { level: 1, text: '恋人の聖地マークを探そう' },
      { level: 2, text: '記念モニュメントの方へ進もう' },
      { level: 3, text: '愛の場所の雰囲気を感じよう' },
      { level: 4, text: '記念モニュメントの前に立とう' },
    ],
    discoveryContent: {
      summary: '2013年に全国でも有数の「恋人の聖地」として認定された記念モニュメント。海王丸パークのロマンチックな風景と相まって、地元だけでなく全国からカップルが訪れます。',
      trivia: [
        '「恋人の聖地」プロジェクトは全国各地のロマンチックな場所を認定する制度です',
        'モニュメント付近には「愛むすび」や「愛鍵」を納める部屋もあります',
        '毎年クリスマスシーズンにはモニュメント周辺が特別にイルミネーションで彩られます',
      ],
      localStory: '認定された当時、地元の高校生たちが周辺の花植えを手伝ったというエピソードが残っています。今でもその花たちがモニュメントを囲んで季節ごとに咲いています。',
      photoTip: '二人並んでモニュメントの真正面から撮るのが定番。太陽の光がモニュメントを斜めに照らす午後が特にフォトジェニックです。',
    },
    reward: { type: 'stamp', name: '愛の聖地', icon: '💕' },
  },
];

const SCREEN_IDS = {
  home: 'home-screen',
  explore: 'explore-screen',
  record: 'record-screen',
};
const NAV_IDS = ['nav-home', 'nav-explore', 'nav-record'];

// ===================================
// Screen Management
// ===================================
function showScreen(name) {
  Object.values(SCREEN_IDS).forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });

  const target = document.getElementById(SCREEN_IDS[name]);
  if (target) target.classList.remove('hidden');

  NAV_IDS.forEach((navId) => {
    const btn = document.getElementById(navId);
    if (!btn) return;
    btn.classList.toggle('active', btn.dataset.screen === name);
  });

  currentScreen = name;

  if (name === 'record') renderDiscoveryList();
  if (name === 'home') renderMissionSelect();
  if (name === 'explore') {
    LocationService.startGeoWatch();
    refreshExploreLocationUI();
  } else {
    LocationService.stopTracking();
  }
}

// ===================================
// Init
// ===================================
document.addEventListener('DOMContentLoaded', () => {
  LocationService.setCallbacks({
    onPositionUpdate: handlePositionUpdate,
    onDwellComplete: handleDwellComplete,
    onSerialDisconnect: updateSerialConnectionUI,
  });

  const loginScreen = document.getElementById('login-screen');
  const mainApp = document.getElementById('main-app');

  document.getElementById('login-btn')?.addEventListener('click', () => {
    loginScreen.classList.add('hidden');
    mainApp.classList.remove('hidden');
    showScreen('home');
  });

  NAV_IDS.forEach((navId) => {
    document.getElementById(navId)?.addEventListener('click', (e) => {
      showScreen(e.currentTarget.dataset.screen);
    });
  });

  document.getElementById('nav-logo-btn')?.addEventListener('click', () => showScreen('home'));
  document.getElementById('resume-explore-btn')?.addEventListener('click', () => showScreen('explore'));
  document.getElementById('update-location-btn')?.addEventListener('click', simulateLocationUpdate);
  document.getElementById('check-arrive-btn')?.addEventListener('click', checkArrival);
  document.getElementById('next-hint-btn')?.addEventListener('click', showNextHint);

  document.getElementById('add-collection-btn')?.addEventListener('click', () => {
    closeDiscovery();
    showScreen('record');
  });

  document.getElementById('back-home-discovery-btn')?.addEventListener('click', () => {
    closeDiscovery();
    showScreen('home');
  });

  document.getElementById('next-mission-btn')?.addEventListener('click', handleNextMission);

  document.getElementById('logout-btn')?.addEventListener('click', () => {
    mainApp.classList.add('hidden');
    loginScreen.classList.remove('hidden');
    LocationService.stopTracking();
  });

  document.getElementById('connect-serial-btn')?.addEventListener('click', connectSerialPort);
  document.getElementById('disconnect-serial-btn')?.addEventListener('click', disconnectSerialPort);

  if (debugConfig.debugMode) {
    document.getElementById('force-clear-btn')?.addEventListener('click', forceClear);
    document.getElementById('debug-show-all-hints-btn')?.addEventListener('click', debugShowAllHints);
    document.getElementById('debug-simulate-qzss-btn')?.addEventListener('click', debugSimulateQZSS);
    document.getElementById('debug-simulate-gps-btn')?.addEventListener('click', debugSimulateGPS);
    document.getElementById('debug-teleport-hot-btn')?.addEventListener('click', debugTeleportHot);
    document.getElementById('debug-teleport-approach-btn')?.addEventListener('click', debugTeleportApproach);
    document.getElementById('debug-reset-missions-btn')?.addEventListener('click', debugResetMissions);
    document.getElementById('debug-clear-all-btn')?.addEventListener('click', debugClearAllMissions);

    document.querySelectorAll('[data-debug-toggle]').forEach((btn) => {
      btn.addEventListener('click', toggleDebugPanel);
    });

    updateDebugUI();
  } else {
    document.getElementById('debug-panel')?.classList.add('hidden');
    document.querySelectorAll('.debug-toggle-btn').forEach((el) => {
      el.style.display = 'none';
    });
  }

  updateUserUI();
  updateStats();
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
// Location UI
// ===================================
function getCurrentMission() {
  return MISSIONS.find((m) => m.id === currentMissionId) || null;
}

function getActiveTolerance(mission) {
  if (!mission) return null;
  return LocationService.isQZSSActive()
    ? mission.targetLocation.tolerance
    : mission.targetLocation.gpsTolerance;
}

function getNextMissionId(afterId) {
  const idx = MISSIONS.findIndex((m) => m.id === afterId);
  if (idx === -1 || idx >= MISSIONS.length - 1) return null;
  return MISSIONS[idx + 1].id;
}

function getPrevMissionId(beforeId) {
  const idx = MISSIONS.findIndex((m) => m.id === beforeId);
  if (idx <= 0) return null;
  return MISSIONS[idx - 1].id;
}

function handlePositionUpdate() {
  refreshExploreLocationUI();
}

function handleDwellComplete() {
  if (!currentMissionId) return;
  completeMission(currentMissionId);
  if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
  showDiscovery();
}

function refreshExploreLocationUI() {
  const mission = getCurrentMission();
  if (!mission || currentScreen !== 'explore') return;

  const pos = LocationService.getPosition();
  const hasCoords = pos.latitude && pos.longitude;
  const activeTol = getActiveTolerance(mission);

  if (hasCoords) {
    currentDistance = LocationService.distanceToTarget(mission.targetLocation);
    const bearing = LocationService.bearingToTarget(mission.targetLocation);
    updateDirectionBearing(bearing, currentDistance, activeTol);
  } else if (LocationService.getProvider() === 'none' && debugConfig.debugMode) {
    currentDistance = simulatedDistance;
    updateDirectionBearing(45, simulatedDistance, activeTol);
  } else {
    currentDistance = null;
    updateDirectionBearing(null, null, activeTol);
  }

  if (currentDistance === null) {
    updateDistanceDisplay('—');
    updateZoneUI('far', 0, { text: '位置情報を取得中…', level: 'none' });
    setArriveButtonState(false, '位置情報を取得中…');
    return;
  }

  const zone = LocationService.getActiveZone(currentDistance);
  let dwellProgress = LocationService.updateDwell(currentDistance);
  const fixStatus = LocationService.getFixStatusLabel();
  let arrival = LocationService.canAttemptArrival(currentDistance);

  if (arrival.ok && activeTol != null && currentDistance > activeTol) {
    arrival = { ok: false, reason: 'tolerance_gate' };
    dwellProgress = 0;
  }

  updateDistanceDisplay(Math.round(currentDistance * 10) / 10);
  updateZoneUI(zone, dwellProgress, fixStatus);
  applyZoneHints(zone);

  if (zone === 'approach' || zone === 'hot') {
    if (!approachStuckSince) approachStuckSince = Date.now();
    else if (Date.now() - approachStuckSince > 90000) showRescueHint();
  } else {
    approachStuckSince = null;
  }

  if (arrival.ok) {
    const pct = Math.round(dwellProgress * 100);
    setArriveButtonState(true, pct >= 100 ? '発見！' : `発見中… ${pct}%`);
    document.getElementById('explore-grid')?.classList.toggle('zone-hot', zone === 'hot');
  } else if (arrival.reason === 'fix_pending') {
    setArriveButtonState(false, '測位中…');
    document.getElementById('explore-grid')?.classList.remove('zone-hot');
  } else if (arrival.reason === 'tolerance_gate') {
    const remain = Math.round((currentDistance - activeTol) * 100) / 100;
    setArriveButtonState(false, `あと ${remain.toFixed(1)}m 中心へ`);
    document.getElementById('explore-grid')?.classList.add('zone-hot');
  } else if (zone === 'hot') {
    setArriveButtonState(false, 'もう少し正確な測位を待っています');
    document.getElementById('explore-grid')?.classList.add('zone-hot');
  } else {
    setArriveButtonState(false, getArriveButtonLabel(zone));
    document.getElementById('explore-grid')?.classList.remove('zone-hot');
  }

  if (debugConfig.debugMode) updateDebugUI();
}

function updateDirectionBearing(bearingDeg, distance, tolerance) {
  const arrowEl = document.getElementById('bearing-arrow');
  const dirLabelEl = document.getElementById('bearing-direction');
  const tolLabelEl = document.getElementById('bearing-tolerance');
  if (!arrowEl) return;

  if (bearingDeg == null) {
    arrowEl.style.transform = 'rotate(0deg)';
    arrowEl.style.opacity = '0.3';
    if (dirLabelEl) dirLabelEl.textContent = '—';
    return;
  }

  arrowEl.style.transform = `rotate(${bearingDeg}deg)`;
  arrowEl.style.opacity = '1';
  if (dirLabelEl) {
    dirLabelEl.textContent = LocationService.bearingToDirectionLabel(bearingDeg);
  }
  if (tolLabelEl) {
    tolLabelEl.textContent = tolerance != null ? `誤差目安: ±${tolerance}m` : '';
  }
}

function updateDistanceDisplay(value) {
  const distEl = document.getElementById('explore-distance');
  if (distEl) distEl.textContent = value;
}

function updateZoneUI(zone, dwellProgress, fixStatus) {
  const zoneEl = document.getElementById('zone-status');
  const fixEl = document.getElementById('fix-status');
  const dwellEl = document.getElementById('dwell-progress');
  const dwellBar = document.getElementById('dwell-progress-bar');

  if (zoneEl) {
    zoneEl.textContent = ZONE_LABELS[zone] || zone;
    zoneEl.dataset.zone = zone;
  }
  if (fixEl) {
    fixEl.textContent = fixStatus.text;
    fixEl.dataset.level = fixStatus.level;
  }
  if (dwellEl) {
    const visible = zone === 'hot' && dwellProgress > 0;
    dwellEl.classList.toggle('hidden', !visible);
    if (visible) dwellEl.textContent = `発見まで ${Math.round(dwellProgress * 100)}%`;
  }
  if (dwellBar) {
    dwellBar.style.width = `${Math.round(dwellProgress * 100)}%`;
    dwellBar.parentElement?.classList.toggle('hidden', zone !== 'hot');
  }
}

function getArriveButtonLabel(zone) {
  if (zone === 'approach') return 'あと少し！';
  if (zone === 'near') return 'まだ近くに…';
  if (zone === 'area') return 'もっと近づこう';
  return 'まだ遠いです';
}

function setArriveButtonState(enabled, label) {
  const btn = document.getElementById('check-arrive-btn');
  if (!btn) return;
  btn.disabled = !enabled && !debugConfig.debugMode;
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
    ${label}
  `;
}

function applyZoneHints(zone) {
  const targetLevel = ZONE_HINT_LEVELS[zone] || 1;
  if (targetLevel > currentHintLevel) {
    currentHintLevel = targetLevel;
    updateHints();
  }
}

function showRescueHint() {
  const rescue = document.getElementById('rescue-hint');
  if (rescue) rescue.classList.remove('hidden');
}

function simulateLocationUpdate() {
  const btn = document.getElementById('update-location-btn');
  if (!btn) return;
  btn.textContent = '更新中...';
  btn.disabled = true;

  setTimeout(() => {
    simulatedDistance = Math.max(15, simulatedDistance - Math.floor(Math.random() * 20 + 5));
    refreshExploreLocationUI();
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13">
        <line x1="22" y1="2" x2="11" y2="13"/>
        <polygon points="22 2 15 22 11 13 2 9 22 2"/>
      </svg>
      現在地を更新
    `;
    btn.disabled = false;
  }, 800);
}

// ===================================
// Arrival Check
// ===================================
function checkArrival() {
  const mission = getCurrentMission();
  if (!mission) return;

  const btn = document.getElementById('check-arrive-btn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '判定中...';
  }

  setTimeout(() => {
    let arrived = false;
    const activeTol = getActiveTolerance(mission);

    if (currentDistance !== null) {
      const base = LocationService.canAttemptArrival(currentDistance);
      if (base.ok) {
        arrived = activeTol == null || currentDistance <= activeTol;
      }
    } else if (debugConfig.debugMode) {
      arrived = true;
    }

    if (arrived) {
      if (currentMissionId) completeMission(currentMissionId);
      showDiscovery();
    } else {
      const base = LocationService.canAttemptArrival(currentDistance ?? Infinity);
      if (currentDistance != null && base.ok && activeTol != null && currentDistance > activeTol) {
        const remain = Math.round((currentDistance - activeTol) * 100) / 100;
        alert(`まだ中心から ${remain.toFixed(1)}m 離れています。もっと一点に近づいてください。`);
      } else {
        alert('まだ発見ゾーンに入っていません。もっと近づいてください。');
      }
    }

    refreshExploreLocationUI();
  }, 600);
}

function completeMission(missionId) {
  if (!missionProgress[missionId]) missionProgress[missionId] = {};
  missionProgress[missionId].completed = true;
  missionProgress[missionId].completedAt = new Date().toISOString();
  localStorage.setItem('geopuzzle_mission_progress', JSON.stringify(missionProgress));

  if (!collection.includes(missionId)) {
    collection.push(missionId);
    localStorage.setItem('geopuzzle_collection', JSON.stringify(collection));
  }
  updateStats();
}

// ===================================
// Debug
// ===================================
function forceClear() {
  if (!debugConfig.debugMode || !debugConfig.forceClearEnabled) return;
  if (currentMissionId) completeMission(currentMissionId);
  showDiscovery();
}

function debugShowAllHints() {
  const mission = getCurrentMission();
  if (!mission) return;
  currentHintLevel = mission.hints.length;
  updateHints();
}

function debugSimulateQZSS() {
  LocationService.simulateQZSSConnect(true);
  updateSerialConnectionUI();
  refreshExploreLocationUI();
}

function debugSimulateGPS() {
  debugConfig.simulateQZSS = false;
  const mission = getCurrentMission();
  if (mission) {
    LocationService.teleportNearTarget(mission.targetLocation, 12, 1);
  }
  refreshExploreLocationUI();
}

function debugTeleportHot() {
  const mission = getCurrentMission();
  if (!mission) return;
  LocationService.teleportNearTarget(mission.targetLocation, 2);
  refreshExploreLocationUI();
}

function debugTeleportApproach() {
  const mission = getCurrentMission();
  if (!mission) return;
  LocationService.teleportNearTarget(mission.targetLocation, 8);
  refreshExploreLocationUI();
}

function debugResetMissions() {
  missionProgress = {};
  collection = [];
  localStorage.removeItem('geopuzzle_mission_progress');
  localStorage.removeItem('geopuzzle_collection');
  updateStats();
  renderMissionSelect();
}

function debugClearAllMissions() {
  MISSIONS.forEach((m) => completeMission(m.id));
  renderMissionSelect();
  alert('全ミッションをクリア状態にしました（テスト用）');
}

function toggleDebugPanel() {
  document.getElementById('debug-panel')?.classList.toggle('hidden');
}

function updateDebugUI() {
  if (!debugConfig.debugMode) return;

  const debugModeStatus = document.getElementById('debug-mode-status');
  if (debugModeStatus) {
    debugModeStatus.textContent = '有効';
    debugModeStatus.style.color = '#4CAF50';
  }

  const dist = currentDistance !== null ? `${Math.round(currentDistance)}m` : `${simulatedDistance}m (sim)`;
  const el = document.getElementById('debug-distance');
  if (el) el.textContent = dist;

  const pos = LocationService.getPosition();
  const posEl = document.getElementById('debug-position');
  if (posEl) {
    posEl.textContent =
      pos.latitude && pos.longitude
        ? `${pos.latitude.toFixed(6)}, ${pos.longitude.toFixed(6)} (fix=${pos.fixQuality})`
        : '-';
  }

  const zoneEl = document.getElementById('debug-zone');
  if (zoneEl && currentDistance !== null) {
    zoneEl.textContent = ZONE_LABELS[LocationService.getActiveZone(currentDistance)];
  }

  updateSerialConnectionUI();
}

// ===================================
// Web Serial (QZ1)
// ===================================
async function connectSerialPort() {
  try {
    await LocationService.connectSerial();
    updateSerialConnectionUI();
    refreshExploreLocationUI();
  } catch (error) {
    console.error('Serial connection failed:', error);
    alert('QZ1 の接続に失敗しました: ' + error.message);
  }
}

async function disconnectSerialPort() {
  await LocationService.disconnectSerial();
  LocationService.startGeoWatch();
  updateSerialConnectionUI();
  refreshExploreLocationUI();
}

function updateSerialConnectionUI() {
  const connected = LocationService.isSerialConnectedState();
  const statusEl = document.getElementById('serial-status');
  const connectBtn = document.getElementById('connect-serial-btn');
  const disconnectBtn = document.getElementById('disconnect-serial-btn');

  if (statusEl) {
    statusEl.textContent = connected ? 'QZ1 接続中' : '未接続';
    statusEl.classList.toggle('connected', connected);
  }
  if (connectBtn) connectBtn.style.display = connected ? 'none' : 'flex';
  if (disconnectBtn) disconnectBtn.style.display = connected ? 'flex' : 'none';

  const qzssStatus = document.getElementById('qzss-status');
  if (qzssStatus) {
    const provider = LocationService.getProvider();
    if (connected) {
      qzssStatus.textContent = 'QZ1 接続中';
      qzssStatus.style.color = '#4CAF50';
    } else if (provider === 'simulated') {
      qzssStatus.textContent = 'シミュレート';
      qzssStatus.style.color = '#FF9800';
    } else if (provider === 'gps') {
      qzssStatus.textContent = '通常 GPS';
      qzssStatus.style.color = '#2196F3';
    } else {
      qzssStatus.textContent = '未接続';
      qzssStatus.style.color = '#999';
    }
  }
}

// ===================================
// Discovery
// ===================================
function showDiscovery() {
  const overlay = document.getElementById('discovery-overlay');
  if (!overlay) return;
  overlay.classList.remove('hidden');
  overlay.style.display = 'flex';

  const mission = getCurrentMission();
  if (!mission) return;

  document.getElementById('discovery-icon').textContent = mission.reward.icon;
  document.getElementById('discovery-title').textContent = mission.title;
  document.getElementById('discovery-message').textContent = mission.description;
  document.getElementById('reward-badge').textContent = mission.reward.name;

  const content = mission.discoveryContent || {};
  const summaryEl = document.getElementById('discovery-summary');
  if (summaryEl) summaryEl.textContent = content.summary || '';

  const triviaWrap = document.getElementById('discovery-trivia');
  if (triviaWrap) {
    if (content.trivia && content.trivia.length) {
      triviaWrap.innerHTML = content.trivia
        .map(
          (t) => `
        <div class="trivia-row">
          <span class="trivia-dot">✦</span>
          <span class="trivia-text">${t}</span>
        </div>`
        )
        .join('');
      triviaWrap.style.display = '';
    } else {
      triviaWrap.style.display = 'none';
    }
  }

  const storyEl = document.getElementById('discovery-story');
  if (storyEl) {
    if (content.localStory) {
      storyEl.textContent = content.localStory;
      storyEl.parentElement.style.display = '';
    } else {
      storyEl.parentElement.style.display = 'none';
    }
  }

  const photoEl = document.getElementById('discovery-phototip');
  if (photoEl) {
    if (content.photoTip) {
      photoEl.textContent = content.photoTip;
      photoEl.parentElement.style.display = '';
    } else {
      photoEl.parentElement.style.display = 'none';
    }
  }

  const nextBtn = document.getElementById('next-mission-btn');
  const nextId = mission ? getNextMissionId(mission.id) : null;
  if (nextBtn) {
    if (nextId) {
      const nextMission = MISSIONS.find((m) => m.id === nextId);
      nextBtn.textContent = `次のミッションへ: ${nextMission?.title || ''}`;
      nextBtn.dataset.nextMissionId = nextId;
      nextBtn.style.display = '';
    } else {
      nextBtn.textContent = '全ミッション 達成！🎉';
      nextBtn.dataset.nextMissionId = '';
      nextBtn.style.display = '';
    }
  }
}

function closeDiscovery() {
  const overlay = document.getElementById('discovery-overlay');
  if (!overlay) return;
  overlay.classList.add('hidden');
  overlay.style.display = 'none';
  LocationService.resetDwell();
}

function handleNextMission() {
  const btn = document.getElementById('next-mission-btn');
  const nextId = btn?.dataset?.nextMissionId;
  closeDiscovery();
  if (nextId) {
    startMission(nextId);
  } else {
    alert('🎉 おめでとうございます！全てのミッションを達成しました。海王丸パークの特別な場所をありがとうございました。');
    showScreen('home');
  }
}

// ===================================
// Collection
// ===================================
function updateStats() {
  const count = collection.length;
  [
    'home-stat-spots',
    'record-stat-cleared',
    'record-stat-cities',
    'record-stat-photos',
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(count).padStart(2, '0');
  });
  const countLabel = document.getElementById('record-count');
  if (countLabel) countLabel.textContent = `${String(count).padStart(2, '0')} / ${MISSIONS.length} MISSIONS`;
}

function renderDiscoveryList() {
  const list = document.getElementById('discovery-list');
  if (!list) return;

  const cleared = MISSIONS.filter((m) => collection.includes(m.id));

  if (cleared.length === 0) {
    list.innerHTML = '<div class="empty-state">まだ発見したスポットがありません</div>';
    return;
  }

  list.innerHTML = cleared
    .map((mission) => {
      const completedAt = missionProgress[mission.id]?.completedAt;
      const date = completedAt
        ? new Date(completedAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', year: 'numeric' })
        : '—';
      return `
    <div class="discovery-item">
      <div class="discovery-item-thumb dark">${mission.reward.icon}</div>
      <div class="discovery-item-info">
        <div class="discovery-item-name">${mission.title}</div>
        <div class="discovery-item-place">富山県 射水市 海王丸パーク</div>
      </div>
      <div class="discovery-item-right">
        <div class="discovery-item-date">${date}</div>
        <div class="discovery-item-status">発見済み</div>
      </div>
    </div>`;
    })
    .join('');
}

// ===================================
// Missions
// ===================================
function renderMissionSelect() {
  const list = document.getElementById('mission-select-list');
  if (!list) return;

  list.innerHTML = MISSIONS.map((mission) => {
    const isCompleted = missionProgress[mission.id]?.completed;
    return `
      <div class="mission-select-item ${isCompleted ? 'completed' : ''}">
        <div class="mission-select-info">
          <div class="mission-select-icon">${mission.reward.icon}</div>
          <div class="mission-select-details">
            <div class="mission-select-title">${mission.title}</div>
            <div class="mission-select-desc">${mission.description}</div>
          </div>
        </div>
        <button class="mission-select-btn ${isCompleted ? 'disabled' : ''}" data-mission-id="${mission.id}" ${isCompleted ? 'disabled' : ''}>
          ${isCompleted ? '完了' : '開始'}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="12" height="12">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      </div>`;
  }).join('');

  list.querySelectorAll('.mission-select-btn:not([disabled])').forEach((btn) => {
    btn.addEventListener('click', () => startMission(btn.dataset.missionId));
  });
}

function startMission(missionId) {
  currentMissionId = missionId;
  currentHintLevel = 1;
  approachStuckSince = null;
  LocationService.resetDwell();
  document.getElementById('rescue-hint')?.classList.add('hidden');
  showScreen('explore');
  updateExploreScreen();
}

function updateExploreScreen() {
  const mission = getCurrentMission();
  if (!mission) return;

  document.getElementById('explore-mission-title').textContent = mission.title;
  document.getElementById('explore-mission-desc').textContent = mission.description;

  const idx = MISSIONS.findIndex((m) => m.id === currentMissionId) + 1;
  document.getElementById('explore-breadcrumb').textContent = `MISSION ${idx} / ${MISSIONS.length}`;

  updateHints();
  refreshExploreLocationUI();
}

function updateHints() {
  const mission = getCurrentMission();
  const container = document.getElementById('hints-container');
  if (!mission || !container) return;

  const visible = mission.hints.filter((h) => h.level <= currentHintLevel);
  container.innerHTML = visible
    .map(
      (hint) => `
    <div class="hint-item hint-level-${hint.level}">
      <div class="hint-level">LEVEL ${hint.level}</div>
      <div class="hint-text">${hint.text}</div>
    </div>`
    )
    .join('');

  const nextBtn = document.getElementById('next-hint-btn');
  if (!nextBtn) return;
  if (currentHintLevel >= mission.hints.length) {
    nextBtn.disabled = true;
    nextBtn.textContent = '全ヒント表示済み';
  } else {
    nextBtn.disabled = false;
    nextBtn.textContent = '次のヒント';
  }
}

function showNextHint() {
  const mission = getCurrentMission();
  if (!mission || currentHintLevel >= mission.hints.length) return;
  currentHintLevel++;
  updateHints();
}
