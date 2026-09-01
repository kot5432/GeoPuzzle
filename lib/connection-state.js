(function (global) {
  function resolveConnectionStatus(input) {
    const isConnected = Boolean(input && input.isConnected);
    const useQZSS = Boolean(input && input.useQZSS);
    const hasPosition = Boolean(input && input.hasPosition);
    const signalQuality = input && input.signalQuality ? input.signalQuality : 'none';

    const connected = isConnected && hasPosition && (useQZSS || signalQuality !== 'none');
    const shouldShowUserPosition = connected;

    let message = '未接続: 位置情報なし';
    if (connected) {
      message = useQZSS ? '接続中: QZSS受信中' : '接続中: 位置情報更新中';
    } else if (isConnected) {
      message = '未接続: 受信が途切れています';
    }

    return {
      connected,
      useQZSS,
      hasPosition,
      signalQuality,
      shouldShowUserPosition,
      message,
    };
  }

  function shouldShowUserPosition(input) {
    return resolveConnectionStatus(input).shouldShowUserPosition;
  }

  const api = { resolveConnectionStatus, shouldShowUserPosition };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  global.ConnectionState = api;
})(typeof window !== 'undefined' ? window : globalThis);
