// アプリケーション状態
let currentUser = null;
let currentSpot = null;
let currentHintIndex = 0;

// DOM要素
const screens = {
    login: document.getElementById('login-screen'),
    home: document.getElementById('home-screen'),
    navigation: document.getElementById('navigation-screen'),
    discovery: document.getElementById('discovery-screen'),
    collection: document.getElementById('collection-screen')
};

// 初期化
function init() {
    setupEventListeners();
    showScreen('login');
}

// 画面切り替え
function showScreen(screenName) {
    Object.values(screens).forEach(screen => screen.classList.add('hidden'));
    screens[screenName].classList.remove('hidden');
}

// イベントリスナー設定
function setupEventListeners() {
    console.log('イベントリスナーを設定中...');
    
    // ログインボタン
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            console.log('ログインボタンがクリックされました');
            currentUser = { id: 'mvp-user' };
            showScreen('home');
        });
    }
    
    // ログアウトボタン
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            console.log('ログアウトボタンがクリックされました');
            currentUser = null;
            showScreen('login');
        });
    }
    
    // コレクションボタン
    const collectionBtn = document.getElementById('collection-btn');
    if (collectionBtn) {
        collectionBtn.addEventListener('click', () => {
            console.log('コレクションボタンがクリックされました');
            showCollectionScreen();
        });
    }
    
    // 海王丸探索開始ボタン
    const startKaiomaruBtn = document.getElementById('start-kaiomaru-btn');
    if (startKaiomaruBtn) {
        startKaiomaruBtn.addEventListener('click', (e) => {
            console.log('海王丸探索開始ボタンがクリックされました');
            startKaiomaruExploration(e);
        });
    }
    
    // 次のヒントボタン
    const nextHintBtn = document.getElementById('next-hint-btn');
    if (nextHintBtn) {
        nextHintBtn.addEventListener('click', showNextHint);
    }
    
    // 発見画面ボタン
    const backExploreBtn = document.getElementById('back-explore-btn');
    if (backExploreBtn) {
        backExploreBtn.addEventListener('click', () => {
            showScreen('navigation');
        });
    }
    
    const addCollectionBtn = document.getElementById('add-collection-btn');
    if (addCollectionBtn) {
        addCollectionBtn.addEventListener('click', addToCollection);
    }
    
    const backHomeDiscoveryBtn = document.getElementById('back-home-discovery-btn');
    if (backHomeDiscoveryBtn) {
        backHomeDiscoveryBtn.addEventListener('click', () => {
            showScreen('home');
        });
    }
    
    // コレクション画面ボタン
    const backHomeCollectionBtn = document.getElementById('back-home-collection-btn');
    if (backHomeCollectionBtn) {
        backHomeCollectionBtn.addEventListener('click', () => {
            showScreen('home');
        });
    }
    
    // 誘導画面
    const backHomeBtn = document.getElementById('back-home-btn');
    if (backHomeBtn) {
        backHomeBtn.addEventListener('click', () => {
            showScreen('home');
        });
    }
    
    const checkPositionBtn = document.getElementById('check-position-btn');
    if (checkPositionBtn) {
        checkPositionBtn.addEventListener('click', checkPosition);
    }
    
    console.log('イベントリスナーの設定が完了しました');
}

// 海王丸探索開始
function startKaiomaruExploration(e) {
    e.preventDefault();
    console.log('海王丸探索を開始します');
    
    // 海王丸のスポット情報を設定
    currentSpot = {
        id: 'kaiomaru',
        name: '海王丸',
        description: '金沢港に展示されている練習船',
        latitude: 36.5678,
        longitude: 136.6543
    };
    
    // ヒントをリセット
    currentHintIndex = 0;
    resetHints();
    
    // 探索画面へ遷移
    showScreen('navigation');
}

// ヒント管理
function showNextHint() {
    currentHintIndex++;
    
    if (currentHintIndex >= 3) {
        // 全ヒント表示済み
        document.getElementById('next-hint-btn').textContent = 'ヒントは全て表示されました';
        document.getElementById('next-hint-btn').disabled = true;
        return;
    }
    
    const nextHint = document.getElementById(`hint-${currentHintIndex + 1}`);
    if (nextHint) {
        nextHint.classList.remove('hidden');
    }
}

function resetHints() {
    currentHintIndex = 0;
    for (let i = 2; i <= 3; i++) {
        const hint = document.getElementById(`hint-${i}`);
        if (hint) {
            hint.classList.add('hidden');
        }
    }
    
    const nextHintBtn = document.getElementById('next-hint-btn');
    if (nextHintBtn) {
        nextHintBtn.textContent = '次のヒント';
        nextHintBtn.disabled = false;
    }
}

// 到着判定（MVP用：簡易版）
function checkPosition() {
    // MVPテスト用：常に成功とみなして発見画面へ遷移
    const resultEl = document.getElementById('position-result');
    if (resultEl) {
        resultEl.textContent = '🎉 ピタッと正解！';
        resultEl.classList.remove('error');
        resultEl.classList.add('success');
    }
    
    // 発見画面へ遷移
    setTimeout(() => {
        showDiscoveryScreen();
    }, 1000);
}

// 発見画面を表示
function showDiscoveryScreen() {
    showScreen('discovery');
}

// コレクションに追加
function addToCollection() {
    console.log('コレクションに追加します');
    
    // ローカルストレージに保存
    let collection = JSON.parse(localStorage.getItem('geopuzzle_collection') || '[]');
    
    if (!collection.includes(currentSpot.id)) {
        collection.push(currentSpot.id);
        localStorage.setItem('geopuzzle_collection', JSON.stringify(collection));
        alert('コレクションに追加しました！');
    } else {
        alert('すでにコレクションに追加されています');
    }
    
    // ホーム画面へ
    showScreen('home');
}

// コレクション画面を表示
function showCollectionScreen() {
    loadCollection();
    showScreen('collection');
}

// コレクションを読み込み
function loadCollection() {
    const collection = JSON.parse(localStorage.getItem('geopuzzle_collection') || '[]');
    const collectionCount = document.getElementById('collection-count');
    const collectionList = document.getElementById('collection-list');
    
    // 発見数を更新
    collectionCount.textContent = collection.length;
    
    // コレクションリストを更新
    if (collection.length === 0) {
        collectionList.innerHTML = '<p class="empty-message">まだ発見したスポットがありません</p>';
    } else {
        collectionList.innerHTML = '';
        
        // 海王丸の情報
        const spots = {
            'kaiomaru': {
                name: '海王丸',
                description: '金沢港に展示されている練習船',
                icon: '⚓'
            }
        };
        
        collection.forEach(spotId => {
            const spot = spots[spotId];
            if (spot) {
                const item = document.createElement('div');
                item.className = 'collection-item';
                item.innerHTML = `
                    <div class="collection-item-icon">${spot.icon}</div>
                    <div class="collection-item-info">
                        <h4>${spot.name}</h4>
                        <p>${spot.description}</p>
                    </div>
                `;
                collectionList.appendChild(item);
            }
        });
    }
}

// DOMContentLoadedイベントで初期化
document.addEventListener('DOMContentLoaded', init);
