/* GeoPuzzle – 環境変数ローダー
 *
 * 役割:
 *   Vercel 環境では /env.js が動的に生成され window.__ENV__ に値が格納される。
 *   ローカル開発では静的な env.js を置いて同じ I/F を提供する。
 *
 * 本ローダーは更にフォールバックを提供し:
 *   - env.js が読み込めない / 値が空 → window.__ENV__ を空オブジェクトで確保
 *   - アプリ側からは EnvLoader.get('KEY') で安全にアクセス可能
 *   - 不足しているキーの一覧を取得できるヘルパーを提供
 */

(function (global) {
  'use strict';

  var ENV_KEYS = [
    'GOOGLE_MAPS_API_KEY',
    'GOOGLE_MAPS_MAP_ID',
  ];

  if (!global.__ENV__ || typeof global.__ENV__ !== 'object') {
    global.__ENV__ = {};
  }

  /** 値が「存在する（空文字でない）」かどうかを判定 */
  function hasKey(key) {
    var v = global.__ENV__[key];
    return typeof v === 'string' && v.length > 0;
  }

  /**
   * 環境変数を取得
   * @param {string} key
   * @param {string} [fallback] 見つからなかった場合のフォールバック値
   * @returns {string}
   */
  function get(key, fallback) {
    if (hasKey(key)) return global.__ENV__[key];
    return typeof fallback === 'string' ? fallback : '';
  }

  /** 必要なキーのうち、不足しているものの一覧を返す */
  function getMissingKeys() {
    return ENV_KEYS.filter(function (k) { return !hasKey(k); });
  }

  /** Google Maps Platform のキー類がすべて揃っているか */
  function isGoogleMapsAvailable() {
    return getMissingKeys().length === 0;
  }

  global.EnvLoader = {
    KEYS: ENV_KEYS.slice(),
    get: get,
    has: hasKey,
    getMissingKeys: getMissingKeys,
    isGoogleMapsAvailable: isGoogleMapsAvailable,
  };
})(window);
