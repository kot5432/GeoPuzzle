// Supabase設定
// ⚠️ 以下の値をSupabaseダッシュボードから取得した正しい値に置き換えてください
const SUPABASE_URL = 'https://txvbafnnyxeamdhnpbsm.supabase.co'; // Project URL
const SUPABASE_PUBLISHABLE_KEY = 'YOUR_SUPABASE_ANON_KEY_HERE'; // anon public key (JWT format: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...)

// Supabaseクライアント初期化
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// アプリケーション状態
let currentUser = null;
let currentSpot = null;
let currentPosition = null;
let watchId = null;
let photoStream = null;

// みちびき受信機関連
let bluetoothDevice = null;
let bluetoothCharacteristic = null;
let receiverConnected = false;

// DOM要素
const screens = {
    login: document.getElementById('login-screen'),
    home: document.getElementById('home-screen'),
    navigation: document.getElementById('navigation-screen'),
    photo: document.getElementById('photo-screen'),
    mission: document.getElementById('mission-screen')
};

// 初期化
async function init() {
    try {
        // Supabase接続チェック
        if (!window.supabase) {
            console.error('Supabaseクライアントが読み込まれていません');
            document.getElementById('auth-error').textContent = 'Supabaseライブラリの読み込みに失敗しました。ページを再読み込みしてください。';
            return;
        }

        // APIキーチェック
        if (SUPABASE_PUBLISHABLE_KEY === 'YOUR_SUPABASE_ANON_KEY_HERE') {
            console.error('Supabase APIキーが設定されていません');
            document.getElementById('auth-error').textContent = '⚠️ Supabase APIキーを設定してください。app.jsのSUPABASE_PUBLISHABLE_KEYを正しい値に置き換えてください。';
            return;
        }

        // セッションチェック
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
            console.error('セッション取得エラー:', error);
            document.getElementById('auth-error').textContent = 'セッションの取得に失敗しました: ' + error.message;
            return;
        }

        if (session) {
            currentUser = session.user;
            showScreen('home');
            loadSpotData();
        } else {
            showScreen('login');
        }

        // 認証状態変更リスナー
        supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN') {
                currentUser = session.user;
                showScreen('home');
                loadSpotData();
            } else if (event === 'SIGNED_OUT') {
                currentUser = null;
                showScreen('login');
            }
        });

        setupEventListeners();
    } catch (error) {
        console.error('初期化エラー:', error);
        document.getElementById('auth-error').textContent = 'アプリの初期化に失敗しました: ' + error.message;
    }
}

// 画面切り替え
function showScreen(screenName) {
    Object.values(screens).forEach(screen => screen.classList.add('hidden'));
    screens[screenName].classList.remove('hidden');
}

// イベントリスナー設定
function setupEventListeners() {
    // ログイン関連
    document.getElementById('login-btn').addEventListener('click', handleLogin);
    document.getElementById('signup-btn').addEventListener('click', handleSignup);
    document.getElementById('google-login-btn').addEventListener('click', handleGoogleLogin);
    document.getElementById('github-login-btn').addEventListener('click', handleGithubLogin);
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    
    // ホーム画面
    document.getElementById('navigate-btn').addEventListener('click', startNavigation);
    
    // 誘導画面
    document.getElementById('back-home-btn').addEventListener('click', () => {
        stopLocationTracking();
        showScreen('home');
    });
    document.getElementById('check-position-btn').addEventListener('click', checkPosition);
    document.getElementById('photo-btn').addEventListener('click', () => {
        showScreen('photo');
        startCamera();
    });
    
    // 写真撮影画面
    document.getElementById('back-nav-btn').addEventListener('click', () => {
        stopCamera();
        showScreen('navigation');
    });
    document.getElementById('capture-btn').addEventListener('click', capturePhoto);
    document.getElementById('retake-btn').addEventListener('click', retakePhoto);
    document.getElementById('save-photo-btn').addEventListener('click', savePhoto);
    document.getElementById('share-photo-btn').addEventListener('click', sharePhoto);
    
    // ミッション画面
    document.getElementById('complete-mission-btn').addEventListener('click', completeMission);
    document.getElementById('back-home-mission-btn').addEventListener('click', () => {
        showScreen('home');
    });
}

// ログイン処理
async function handleLogin() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorEl = document.getElementById('auth-error');
    
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        
        if (error) throw error;
        
        errorEl.textContent = '';
    } catch (error) {
        errorEl.textContent = 'ログインに失敗しました: ' + error.message;
    }
}

// 新規登録処理
async function handleSignup() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorEl = document.getElementById('auth-error');
    
    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password
        });
        
        if (error) throw error;
        
        errorEl.textContent = '登録確認メールを送信しました。メールを確認してください。';
    } catch (error) {
        errorEl.textContent = '登録に失敗しました: ' + error.message;
    }
}

// Googleログイン
async function handleGoogleLogin() {
    try {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google'
        });
        
        if (error) throw error;
    } catch (error) {
        document.getElementById('auth-error').textContent = 'Googleログインに失敗しました: ' + error.message;
    }
}

// GitHubログイン
async function handleGithubLogin() {
    try {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'github'
        });
        
        if (error) throw error;
    } catch (error) {
        document.getElementById('auth-error').textContent = 'GitHubログインに失敗しました: ' + error.message;
    }
}

// ログアウト処理
async function handleLogout() {
    await supabase.auth.signOut();
    stopLocationTracking();
}

// スポットデータ読み込み
async function loadSpotData() {
    try {
        const { data: spots, error } = await supabase
            .from('spots')
            .select('*')
            .eq('is_active', true)
            .single();
        
        if (error) throw error;
        
        currentSpot = spots;
        
        // ホーム画面に表示
        document.getElementById('spot-name').textContent = spots.name;
        document.getElementById('spot-description').textContent = spots.description;
        
        // 現在地を取得して距離を計算
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const distance = calculateDistance(
                        position.coords.latitude,
                        position.coords.longitude,
                        spots.target_latitude,
                        spots.target_longitude
                    );
                    document.getElementById('spot-distance').textContent = distance.toFixed(1) + 'm';
                },
                (error) => {
                    document.getElementById('spot-distance').textContent = '位置情報を取得できません';
                }
            );
        }
    } catch (error) {
        console.error('スポットデータの読み込みに失敗しました:', error);
        document.getElementById('spot-name').textContent = 'データ読み込みエラー';
        document.getElementById('spot-description').textContent = 'スポット情報を取得できませんでした';
    }
}

// みちびき受信機接続
async function connectQZSSReceiver() {
    if (!navigator.bluetooth) {
        console.log('Web Bluetooth APIがサポートされていません');
        return false;
    }

    try {
        // みちびき受信機のBluetoothサービスを探索
        // 一般的なGNSS受信機のUUID（実際の受信機に合わせて調整が必要）
        const SERVICE_UUID = '00001800-0000-1000-8000-00805f9b34fb'; // Generic Access
        const CHARACTERISTIC_UUID = '00002a00-0000-1000-8000-00805f9b34fb'; // Device Name

        bluetoothDevice = await navigator.bluetooth.requestDevice({
            filters: [{ services: [SERVICE_UUID] }],
            optionalServices: [SERVICE_UUID]
        });

        console.log('受信機を発見:', bluetoothDevice.name);

        bluetoothDevice.addEventListener('gattserverdisconnected', onDisconnected);

        const server = await bluetoothDevice.gatt.connect();
        const service = await server.getPrimaryService(SERVICE_UUID);
        bluetoothCharacteristic = await service.getCharacteristic(CHARACTERISTIC_UUID);

        // 位置情報データの受信を開始
        await bluetoothCharacteristic.startNotifications();
        bluetoothCharacteristic.addEventListener('characteristicvaluechanged', handleReceiverData);

        receiverConnected = true;
        useHighPrecision = true;
        updateReceiverStatus();
        
        return true;
    } catch (error) {
        console.error('受信機接続エラー:', error);
        receiverConnected = false;
        useHighPrecision = false;
        updateReceiverStatus();
        return false;
    }
}

// 受信機からのデータ処理
function handleReceiverData(event) {
    const value = event.target.value;
    // 受信機からのデータをパースして位置情報を取得
    // 実際の受信機のプロトコルに合わせて実装が必要
    // ここではサンプルとしてNMEAフォーマットを想定
    
    const decoder = new TextDecoder();
    const text = decoder.decode(value);
    
    // NMEAデータのパース（簡易版）
    if (text.includes('$GNGGA') || text.includes('$GPGGA')) {
        const parts = text.split(',');
        if (parts.length >= 10) {
            const latitude = parseNMEACoordinate(parts[2], parts[3]);
            const longitude = parseNMEACoordinate(parts[4], parts[5]);
            
            if (latitude && longitude) {
                currentPosition = { latitude, longitude };
                updateNavigationDisplay();
            }
        }
    }
}

// NMEA座標パース
function parseNMEACoordinate(coord, direction) {
    if (!coord || !direction) return null;
    
    const degrees = parseInt(coord.substring(0, coord.length - 10)) || 0;
    const minutes = parseFloat(coord.substring(coord.length - 10)) / 60;
    const decimal = degrees + minutes;
    
    return (direction === 'S' || direction === 'W') ? -decimal : decimal;
}

// 受信機切断時の処理
function onDisconnected() {
    console.log('受信機が切断されました');
    receiverConnected = false;
    updateReceiverStatus();
    
    alert('⚠️ みちびき受信機が切断されました。ナビゲーションを終了します。');
    showScreen('home');
}

// 受信機ステータス更新
function updateReceiverStatus() {
    const statusElement = document.getElementById('receiver-status');
    if (statusElement) {
        if (receiverConnected) {
            statusElement.textContent = '🟢 みちびき受信機接続中（高精度測位）';
            statusElement.className = 'receiver-status connected';
        } else {
            statusElement.textContent = '🔴 受信機未接続';
            statusElement.className = 'receiver-status disconnected';
        }
    }
}

// ナビゲーション開始
async function startNavigation() {
    if (!currentSpot) return;
    
    // みちびき受信機の接続を試みる
    const connected = await connectQZSSReceiver();
    
    if (!connected) {
        alert('⚠️ みちびき受信機が見つかりません。このアプリはみちびき受信機が必要です。\n\n対応受信機:\n- LRTK Phone 4C（レフィクシア）\n- QZR-SP（JPS）\n- RJCLAS-L6（小峰無線電機）\n\n受信機の電源を入れ、Bluetoothを有効にしてから再試行してください。');
        return;
    }
    
    showScreen('navigation');
    
    document.getElementById('nav-spot-name').textContent = currentSpot.name;
    document.getElementById('nav-spot-description').textContent = currentSpot.description;
    
    updateReceiverStatus();
}

// ナビゲーション表示更新（受信機専用）
function updateNavigationDisplay() {
    if (!currentPosition || !currentSpot) return;
    
    const distance = calculateDistance(
        currentPosition.latitude,
        currentPosition.longitude,
        currentSpot.target_latitude,
        currentSpot.target_longitude
    );
    
    document.getElementById('nav-distance').textContent = distance.toFixed(2) + 'm';
    
    // みちびき受信機による数cm精度判定
    const tolerance = 0.1; // 10cm
    
    if (distance < tolerance) {
        document.getElementById('position-status').textContent = 'ピタッと位置にいます！';
        document.getElementById('position-circle').classList.add('success');
        document.getElementById('position-circle').classList.remove('error');
    } else {
        document.getElementById('position-status').textContent = 
            `ターゲット位置に近づいてください（あと${distance.toFixed(2)}m）`;
        document.getElementById('position-circle').classList.remove('success');
    }
}

// 位置情報エラー処理
function handleLocationError(error) {
    console.error('位置情報エラー:', error);
    document.getElementById('position-status').textContent = '位置情報の取得に失敗しました';
}

// 位置情報追跡停止
function stopLocationTracking() {
    if (watchId) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }
    
    // Bluetooth接続も切断
    if (bluetoothDevice && bluetoothDevice.gatt.connected) {
        bluetoothDevice.gatt.disconnect();
    }
}

// ピタッと判定
function checkPosition() {
    if (!currentPosition || !currentSpot) {
        document.getElementById('position-result').textContent = '位置情報を取得できません';
        document.getElementById('position-result').classList.add('error');
        return;
    }
    
    if (!receiverConnected) {
        document.getElementById('position-result').textContent = 'みちびき受信機が接続されていません';
        document.getElementById('position-result').classList.add('error');
        return;
    }
    
    const distance = calculateDistance(
        currentPosition.latitude,
        currentPosition.longitude,
        currentSpot.target_latitude,
        currentSpot.target_longitude
    );
    
    const resultEl = document.getElementById('position-result');
    const positionCircle = document.getElementById('position-circle');
    
    // みちびき受信機による数cm精度判定
    const tolerance = 0.1; // 10cm
    
    if (distance < tolerance) {
        resultEl.textContent = '🎉 ピタッと正解！';
        resultEl.classList.remove('error');
        resultEl.classList.add('success');
        positionCircle.classList.add('success');
        positionCircle.classList.remove('error');
        
        // 写真撮影ボタンを表示
        document.getElementById('photo-btn').classList.remove('hidden');
        
        // 達成記録を保存
        recordAchievement('position');
    } else {
        resultEl.textContent = `❌ あと${distance.toFixed(2)}mです`;
        resultEl.classList.remove('success');
        resultEl.classList.add('error');
        positionCircle.classList.add('error');
        positionCircle.classList.remove('success');
    }
}

// 距離計算（Haversine formula）
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // 地球の半径（メートル）
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

// カメラ起動
async function startCamera() {
    try {
        photoStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
        });
        
        const video = document.getElementById('camera-preview');
        video.srcObject = photoStream;
        
        // フォトフレームを適用
        applyPhotoFrame();
    } catch (error) {
        console.error('カメラの起動に失敗しました:', error);
        alert('カメラの起動に失敗しました。カメラの権限を確認してください。');
    }
}

// カメラ停止
function stopCamera() {
    if (photoStream) {
        photoStream.getTracks().forEach(track => track.stop());
        photoStream = null;
    }
}

// フォトフレーム適用
async function applyPhotoFrame() {
    try {
        const { data: frame, error } = await supabase
            .from('photo_frames')
            .select('*')
            .eq('spot_id', currentSpot.id)
            .eq('is_active', true)
            .single();
        
        if (error) throw error;
        
        const photoFrame = document.getElementById('photo-frame');
        if (frame.frame_url) {
            photoFrame.style.backgroundImage = `url(${frame.frame_url})`;
            photoFrame.style.backgroundSize = 'cover';
            photoFrame.style.backgroundPosition = 'center';
        }
    } catch (error) {
        console.error('フォトフレームの読み込みに失敗しました:', error);
    }
}

// 写真撮影
function capturePhoto() {
    const video = document.getElementById('camera-preview');
    const canvas = document.getElementById('photo-canvas');
    const capturedPhoto = document.getElementById('captured-photo');
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    
    const imageData = canvas.toDataURL('image/jpeg');
    capturedPhoto.src = imageData;
    
    video.classList.add('hidden');
    capturedPhoto.classList.remove('hidden');
    
    document.getElementById('capture-btn').classList.add('hidden');
    document.getElementById('retake-btn').classList.remove('hidden');
    document.getElementById('save-photo-btn').classList.remove('hidden');
    document.getElementById('share-photo-btn').classList.remove('hidden');
}

// 撮り直し
function retakePhoto() {
    const video = document.getElementById('camera-preview');
    const capturedPhoto = document.getElementById('captured-photo');
    
    video.classList.remove('hidden');
    capturedPhoto.classList.add('hidden');
    
    document.getElementById('capture-btn').classList.remove('hidden');
    document.getElementById('retake-btn').classList.add('hidden');
    document.getElementById('save-photo-btn').classList.add('hidden');
    document.getElementById('share-photo-btn').classList.add('hidden');
}

// 写真保存
async function savePhoto() {
    const capturedPhoto = document.getElementById('captured-photo');
    const imageData = capturedPhoto.src;
    
    try {
        const { data, error } = await supabase
            .from('photo_logs')
            .insert({
                user_id: currentUser.id,
                spot_id: currentSpot.id,
                photo_data: imageData,
                created_at: new Date().toISOString()
            });
        
        if (error) throw error;
        
        alert('写真を保存しました！');
        
        // ミッション画面へ
        showScreen('mission');
        loadMission();
    } catch (error) {
        console.error('写真の保存に失敗しました:', error);
        alert('写真の保存に失敗しました');
    }
}

// SNS共有
function sharePhoto() {
    const capturedPhoto = document.getElementById('captured-photo');
    
    if (navigator.share) {
        capturedPhoto.toBlob((blob) => {
            const file = new File([blob], 'geopuzzle.jpg', { type: 'image/jpeg' });
            navigator.share({
                title: 'GeoPuzzle',
                text: `GeoPuzzleで${currentSpot.name}のベストショットを撮りました！`,
                files: [file]
            });
        });
    } else {
        // Web Share APIが使えない場合はダウンロード
        const link = document.createElement('a');
        link.download = 'geopuzzle.jpg';
        link.href = capturedPhoto.src;
        link.click();
    }
}

// ミッション読み込み
async function loadMission() {
    try {
        const { data: mission, error } = await supabase
            .from('missions')
            .select('*')
            .eq('spot_id', currentSpot.id)
            .eq('is_active', true)
            .single();
        
        if (error) throw error;
        
        document.getElementById('mission-text').textContent = mission.description;
        
        // 達成状況チェック
        const { data: achievement } = await supabase
            .from('achievements')
            .select('*')
            .eq('user_id', currentUser.id)
            .eq('mission_id', mission.id)
            .single();
        
        if (achievement) {
            document.getElementById('mission-status').textContent = '達成済み';
            document.getElementById('mission-status').classList.add('completed');
            document.getElementById('complete-mission-btn').classList.add('hidden');
        } else {
            document.getElementById('mission-status').textContent = '未達成';
            document.getElementById('mission-status').classList.remove('completed');
            document.getElementById('complete-mission-btn').classList.remove('hidden');
        }
    } catch (error) {
        console.error('ミッションの読み込みに失敗しました:', error);
        document.getElementById('mission-text').textContent = 'ミッション情報を取得できませんでした';
    }
}

// ミッション達成
async function completeMission() {
    try {
        const { data: mission, error: missionError } = await supabase
            .from('missions')
            .select('*')
            .eq('spot_id', currentSpot.id)
            .eq('is_active', true)
            .single();
        
        if (missionError) throw missionError;
        
        const { error } = await supabase
            .from('achievements')
            .insert({
                user_id: currentUser.id,
                mission_id: mission.id,
                achieved_at: new Date().toISOString()
            });
        
        if (error) throw error;
        
        document.getElementById('mission-status').textContent = '達成済み';
        document.getElementById('mission-status').classList.add('completed');
        document.getElementById('complete-mission-btn').classList.add('hidden');
        
        alert('🎉 ミッション達成！');
    } catch (error) {
        console.error('ミッション達成の記録に失敗しました:', error);
        alert('ミッション達成の記録に失敗しました');
    }
}

// 達成記録
async function recordAchievement(type) {
    try {
        if (type === 'position') {
            await supabase
                .from('achievements')
                .insert({
                    user_id: currentUser.id,
                    spot_id: currentSpot.id,
                    achievement_type: 'position',
                    achieved_at: new Date().toISOString()
                });
        }
    } catch (error) {
        console.error('達成記録の保存に失敗しました:', error);
    }
}

// アプリ起動
init();
