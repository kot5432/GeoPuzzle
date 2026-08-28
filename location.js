/* GeoPuzzle – 位置情報サービス（QZ1 / Web Serial / GPS フォールバック） */

const LocationService = (() => {
  let position = {
    latitude: null,
    longitude: null,
    fixQuality: 0,
    hdop: null,
    satellites: null,
    accuracy: null,
    timestamp: null,
  };

  let provider = 'none'; // 'qzss' | 'gps' | 'simulated' | 'none'
  let serialPort = null;
  let serialReader = null;
  let isSerialConnected = false;
  let nmeaBuffer = '';
  let geoWatchId = null;
  let wakeLock = null;
  let dwellStartTime = null;
  let onPositionUpdate = null;
  let onDwellComplete = null;
  let onSerialDisconnect = null;

  function setCallbacks(callbacks) {
    onPositionUpdate = callbacks.onPositionUpdate || null;
    onDwellComplete = callbacks.onDwellComplete || null;
    onSerialDisconnect = callbacks.onSerialDisconnect || null;
  }

  function getPosition() {
    return { ...position };
  }

  function getProvider() {
    return provider;
  }

  function isQZSSActive() {
    return provider === 'qzss' || provider === 'simulated';
  }

  function isSerialConnectedState() {
    return isSerialConnected;
  }

  function getZoneConfig() {
    return isQZSSActive() ? ZONES.qzss : ZONES.gps;
  }

  function getActiveZone(distance) {
    const z = getZoneConfig();
    if (distance <= z.hot) return 'hot';
    if (distance <= z.approach) return 'approach';
    if (distance <= z.near) return 'near';
    if (distance <= z.area) return 'area';
    return 'far';
  }

  function canAttemptArrival(distance) {
    const zone = getActiveZone(distance);
    if (zone !== 'hot') return { ok: false, reason: 'not_hot' };

    const z = getZoneConfig();
    if (isQZSSActive() && position.fixQuality < z.minFix) {
      return { ok: false, reason: 'fix_pending' };
    }
    return { ok: true, reason: null };
  }

  function getDwellProgress(distance) {
    const check = canAttemptArrival(distance);
    if (!check.ok) {
      dwellStartTime = null;
      return 0;
    }

    const z = getZoneConfig();
    const now = Date.now();
    if (!dwellStartTime) dwellStartTime = now;

    const elapsed = now - dwellStartTime;
    return Math.min(1, elapsed / z.dwellMs);
  }

  function resetDwell() {
    dwellStartTime = null;
  }

  function updateDwell(distance) {
    const progress = getDwellProgress(distance);
    if (progress >= 1 && onDwellComplete) {
      resetDwell();
      onDwellComplete();
    }
    return progress;
  }

  function notifyUpdate() {
    if (onPositionUpdate) onPositionUpdate(getPosition(), provider);
  }

  function applyPosition(lat, lon, meta = {}) {
    position = {
      latitude: lat,
      longitude: lon,
      fixQuality: meta.fixQuality ?? position.fixQuality,
      hdop: meta.hdop ?? position.hdop,
      satellites: meta.satellites ?? position.satellites,
      accuracy: meta.accuracy ?? position.accuracy,
      timestamp: Date.now(),
    };
    notifyUpdate();
  }

  function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(Δφ / 2) ** 2 +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function calculateBearing(lat1, lon1, lat2, lon2) {
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x =
      Math.cos(φ1) * Math.sin(φ2) -
      Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    const θ = Math.atan2(y, x);
    return ((θ * 180) / Math.PI + 360) % 360;
  }

  function bearingToDirectionLabel(bearingDeg) {
    const dirs = [
      '北', '北北東', '北東', '東北東',
      '東', '東南東', '南東', '南南東',
      '南', '南南西', '南西', '西南西',
      '西', '西北西', '北西', '北北西',
    ];
    const idx = Math.round(bearingDeg / 22.5) % 16;
    return dirs[idx];
  }

  function bearingToTarget(target) {
    if (!position.latitude || !position.longitude || !target) return null;
    return calculateBearing(
      position.latitude,
      position.longitude,
      target.latitude,
      target.longitude
    );
  }

  function distanceToTarget(target) {
    if (!position.latitude || !position.longitude || !target) return null;
    return calculateDistance(
      position.latitude,
      position.longitude,
      target.latitude,
      target.longitude
    );
  }

  function parseNMEACoordinate(coord, direction) {
    if (!coord || !direction) return null;
    const degrees = Math.floor(parseFloat(coord) / 100);
    const minutes = parseFloat(coord) - degrees * 100;
    const decimal = degrees + minutes / 60;
    return direction === 'S' || direction === 'W' ? -decimal : decimal;
  }

  function parseNMEASentence(sentence) {
    if (sentence.startsWith('$GPGGA') || sentence.startsWith('$GNGGA')) {
      const parts = sentence.split(',');
      if (parts.length < 6) return;

      const lat = parseNMEACoordinate(parts[2], parts[3]);
      const lon = parseNMEACoordinate(parts[4], parts[5]);
      const fixQuality = parseInt(parts[6], 10) || 0;
      const satellites = parts[7] ? parseInt(parts[7], 10) : null;
      const hdop = parts[8] ? parseFloat(parts[8]) : null;

      if (lat && lon) {
        provider = debugConfig.simulateQZSS ? 'simulated' : 'qzss';
        applyPosition(lat, lon, {
          fixQuality,
          satellites,
          hdop,
          accuracy: hdop ? hdop * 1.5 : null,
        });
      }
      return;
    }

    if (sentence.startsWith('$GPRMC') || sentence.startsWith('$GNRMC')) {
      const parts = sentence.split(',');
      if (parts.length < 7) return;
      const lat = parseNMEACoordinate(parts[3], parts[4]);
      const lon = parseNMEACoordinate(parts[5], parts[6]);
      if (lat && lon) {
        provider = debugConfig.simulateQZSS ? 'simulated' : 'qzss';
        applyPosition(lat, lon, {});
      }
    }
  }

  function processNMEAData(chunk) {
    nmeaBuffer += chunk;
    const lines = nmeaBuffer.split(/\r?\n/);
    nmeaBuffer = lines.pop() || '';

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('$')) parseNMEASentence(trimmed);
    });
  }

  async function readSerialLoop() {
    while (serialPort && serialPort.readable) {
      serialReader = serialPort.readable.getReader();
      try {
        while (true) {
          const { value, done } = await serialReader.read();
          if (done) break;
          processNMEAData(new TextDecoder().decode(value));
        }
      } catch (error) {
        if (error.name !== 'NetworkError') {
          console.error('Serial read error:', error);
        }
      } finally {
        serialReader.releaseLock();
      }
    }
  }

  async function requestWakeLock() {
    if (!('wakeLock' in navigator)) return;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => {
        wakeLock = null;
      });
    } catch (e) {
      console.warn('Wake Lock unavailable:', e.message);
    }
  }

  async function releaseWakeLock() {
    if (wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  }

  function setupSerialEventListeners() {
    if (!navigator.serial) return;

    navigator.serial.addEventListener('connect', () => {
      console.log('Serial device connected');
    });

    navigator.serial.addEventListener('disconnect', (event) => {
      if (serialPort === event.target || !serialPort) {
        handleSerialDisconnect();
      }
    });
  }

  function handleSerialDisconnect() {
    isSerialConnected = false;
    serialPort = null;
    serialReader = null;
    nmeaBuffer = '';
    if (provider === 'qzss') provider = geoWatchId ? 'gps' : 'none';
    releaseWakeLock();
    if (onSerialDisconnect) onSerialDisconnect();
    notifyUpdate();
  }

  async function connectSerial() {
    if (!navigator.serial) {
      throw new Error(
        'Web Serial API はこのブラウザで利用できません。Android では Chrome 148 以降が必要です。'
      );
    }

    let port = null;
    const ports = await navigator.serial.getPorts();
    if (ports.length > 0) {
      port = ports[0];
    } else {
      port = await navigator.serial.requestPort();
    }

    await port.open({ baudRate: QZ1_SERIAL.baudRate });

    serialPort = port;
    isSerialConnected = true;
    provider = 'qzss';
    debugConfig.simulateQZSS = false;
    stopGeoWatch();
    await requestWakeLock();
    readSerialLoop();
    notifyUpdate();
    return true;
  }

  async function disconnectSerial() {
    try {
      if (serialReader) {
        await serialReader.cancel();
        serialReader = null;
      }
      if (serialPort) {
        await serialPort.close();
      }
    } catch (error) {
      console.error('Serial disconnect error:', error);
    }
    handleSerialDisconnect();
  }

  function startGeoWatch() {
    if (!navigator.geolocation || geoWatchId !== null || isSerialConnected) return;

    geoWatchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (isSerialConnected) return;
        provider = 'gps';
        applyPosition(pos.coords.latitude, pos.coords.longitude, {
          fixQuality: 1,
          accuracy: pos.coords.accuracy,
        });
      },
      (err) => console.warn('Geolocation error:', err.message),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );
  }

  function stopGeoWatch() {
    if (geoWatchId !== null) {
      navigator.geolocation.clearWatch(geoWatchId);
      geoWatchId = null;
    }
  }

  function stopTracking() {
    stopGeoWatch();
    releaseWakeLock();
    resetDwell();
  }

  /** デバッグ: QZ1 接続シミュレート */
  function simulateQZSSConnect(enable = true) {
    debugConfig.simulateQZSS = enable;
    if (enable) {
      provider = 'simulated';
      applyPosition(36.7777, 137.1234, {
        fixQuality: 2,
        satellites: 8,
        hdop: 0.9,
        accuracy: 1.0,
      });
    } else {
      provider = geoWatchId ? 'gps' : 'none';
      notifyUpdate();
    }
  }

  /** デバッグ: 座標を手動設定 */
  function simulatePosition(lat, lon, fixQuality = 2) {
    provider = 'simulated';
    debugConfig.simulateQZSS = true;
    applyPosition(lat, lon, {
      fixQuality,
      satellites: 8,
      hdop: 0.9,
      accuracy: fixQuality >= 2 ? 1.0 : 5.0,
    });
  }

  /** デバッグ: 目標から指定距離の位置へテレポート */
  function teleportNearTarget(target, distanceMeters, fixQuality = 2) {
    if (!target) return;
    const bearing = Math.random() * 2 * Math.PI;
    const R = 6371e3;
    const lat1 = (target.latitude * Math.PI) / 180;
    const lon1 = (target.longitude * Math.PI) / 180;
    const d = distanceMeters / R;
    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(bearing)
    );
    const lon2 =
      lon1 +
      Math.atan2(
        Math.sin(bearing) * Math.sin(d) * Math.cos(lat1),
        Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
      );
    simulatePosition((lat2 * 180) / Math.PI, (lon2 * 180) / Math.PI, fixQuality);
  }

  function getFixStatusLabel() {
    if (provider === 'none') return { text: '位置情報なし', level: 'none' };
    if (provider === 'gps') {
      return { text: '通常 GPS モード（約5〜10m）', level: 'gps' };
    }
    if (position.fixQuality >= 2) {
      return { text: 'みちびき測位中（SLAS）', level: 'slas' };
    }
    if (position.fixQuality === 1) {
      return { text: '測位中…空が見える場所で待ってください', level: 'acquiring' };
    }
    return { text: '測位不可', level: 'none' };
  }

  setupSerialEventListeners();

  return {
    setCallbacks,
    getPosition,
    getProvider,
    isQZSSActive,
    isSerialConnectedState,
    getZoneConfig,
    getActiveZone,
    canAttemptArrival,
    getDwellProgress,
    updateDwell,
    resetDwell,
    calculateDistance,
    distanceToTarget,
    calculateBearing,
    bearingToTarget,
    bearingToDirectionLabel,
    connectSerial,
    disconnectSerial,
    startGeoWatch,
    stopGeoWatch,
    stopTracking,
    simulateQZSSConnect,
    simulatePosition,
    teleportNearTarget,
    getFixStatusLabel,
  };
})();
