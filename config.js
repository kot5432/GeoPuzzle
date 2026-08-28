/* GeoPuzzle – アプリ設定
 *
 * 【本番デプロイ前に必ず変更】
 * debugMode: false に設定してください。
 * デバッグモードのまま本番に出すと、強制クリア等のチートが可能になります。
 *
 * 【開発者用メモ】
 * 本番環境で一時的にデバッグモードを有効にしたい場合は、
 * URLの末尾に #debug を付与してアクセスしてください。
 *   例: https://your-domain.com/#debug
 */

const debugConfig = {
  debugMode: true,
  forceClearEnabled: true,
  simulateQZSS: false,
};

(function applyRuntimeDebugOverrides() {
  try {
    const hash = (window.location.hash || '').toLowerCase();
    if (hash === '#debug') {
      debugConfig.debugMode = true;
      debugConfig.forceClearEnabled = true;
    }
    if (hash === '#production' || hash === '#prod') {
      debugConfig.debugMode = false;
      debugConfig.forceClearEnabled = false;
    }
  } catch (e) {}
})();

/** QZ1（L1S/SLAS）向けゾーン — ゲーム性重視
 *  hot:       滞在+最終toleranceゲートで発見判定
 *  approach:  距離表示が「あと少し」になり、レスキューヒントが有効に
 *  near:      Level3ヒント解放
 *  area:      Level2ヒント解放
 *  dwellMs:   hotゾーン かつ tolerance内 での必要滞在時間
 *  minFix:    到着判定に必要な最低NMEA fix quality（QZSSのみ）
 *                0=無効 / 1=GPS / 2=DGPS(SLAS) / 4=RTK Fixed / 5=RTK Float
 */
const ZONES = {
  qzss: {
    hot: 3,
    approach: 10,
    near: 30,
    area: 100,
    dwellMs: 2000,
    minFix: 2,
  },
  gps: {
    hot: 8,
    approach: 20,
    near: 50,
    area: 150,
    dwellMs: 3000,
    minFix: 0,
  },
};

const ZONE_LABELS = {
  far: '探索エリア外',
  area: 'この辺りです',
  near: '近づいています',
  approach: 'もうすぐ！',
  hot: '発見ゾーン',
};

const ZONE_HINT_LEVELS = {
  far: 1,
  area: 2,
  near: 3,
  approach: 4,
  hot: 4,
};

const QZ1_SERIAL = {
  baudRate: 115200,
};
