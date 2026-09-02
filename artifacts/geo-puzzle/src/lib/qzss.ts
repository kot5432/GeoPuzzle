import type { Fix } from '@/lib/geo';
import type { NmeaSatellite, NmeaUpdate } from '@/lib/nmea';

export type SignalQuality = 'excellent' | 'good' | 'poor' | 'none';

export type QzssState = {
  position: { latitude: number | null; longitude: number | null; altitude: number | null };
  accuracy: { hdop: number | null; pdop: number | null; vdop: number | null };
  satellites: {
    total: number;
    used: number;
    gps: number;
    qzss: number;
    glonass: number;
    details: NmeaSatellite[];
  };
  fixQuality: number | null;
  signalQuality: SignalQuality;
  timestamp: number | null;
};

export const QZSS_BAUD_RATE = 115_200;
export const POSITION_STALE_MS = 10_000;

export function createInitialQzssState(): QzssState {
  return {
    position: { latitude: null, longitude: null, altitude: null },
    accuracy: { hdop: null, pdop: null, vdop: null },
    satellites: { total: 0, used: 0, gps: 0, qzss: 0, glonass: 0, details: [] },
    fixQuality: null,
    signalQuality: 'none',
    timestamp: null,
  };
}

function countConstellations(details: NmeaSatellite[]) {
  return {
    gps: details.filter((satellite) => satellite.prn >= 1 && satellite.prn <= 32).length,
    qzss: details.filter((satellite) => satellite.prn >= 193 && satellite.prn <= 202).length,
    glonass: details.filter((satellite) => satellite.prn >= 65 && satellite.prn <= 96).length,
  };
}

export function evaluateSignalQuality(state: QzssState): SignalQuality {
  const { total } = state.satellites;
  const hdop = state.accuracy.hdop;
  const fixQuality = state.fixQuality ?? 0;

  if (total >= 8 && hdop !== null && hdop < 2 && fixQuality >= 2) return 'excellent';
  if (total >= 5 && hdop !== null && hdop < 5 && fixQuality >= 2) return 'good';
  if (total >= 3 && fixQuality >= 1) return 'poor';
  // デバッグ用: Fix Qualityが0でも衛星があれば信号弱として扱う（屋内テスト用）
  if (total >= 1 && fixQuality >= 0) return 'poor';
  return 'none';
}

export function mergeNmeaUpdate(state: QzssState, update: NmeaUpdate): QzssState {
  const next: QzssState = {
    ...state,
    position: { ...state.position },
    accuracy: { ...state.accuracy },
    satellites: { ...state.satellites, details: [...state.satellites.details] },
  };

  if (update.latitude !== undefined && update.longitude !== undefined) {
    next.position.latitude = update.latitude;
    next.position.longitude = update.longitude;
    next.timestamp = Date.now();
  }
  if (update.altitude !== undefined) next.position.altitude = update.altitude;
  if (update.hdop !== undefined && update.hdop !== null) next.accuracy.hdop = update.hdop;
  if (update.pdop !== undefined && update.pdop !== null) next.accuracy.pdop = update.pdop;
  if (update.vdop !== undefined && update.vdop !== null) next.accuracy.vdop = update.vdop;
  if (update.fixQuality !== undefined && update.fixQuality !== null) next.fixQuality = update.fixQuality;
  if (update.satellitesUsed !== undefined && update.satellitesUsed !== null) next.satellites.used = update.satellitesUsed;
  if (update.satellitesTotal !== undefined && update.satellitesTotal !== null) next.satellites.total = update.satellitesTotal;
  if (update.satelliteDetails?.length) {
    next.satellites.details.push(...update.satelliteDetails);
    const counts = countConstellations(next.satellites.details);
    next.satellites.gps = counts.gps;
    next.satellites.qzss = counts.qzss;
    next.satellites.glonass = counts.glonass;
  }

  next.signalQuality = evaluateSignalQuality(next);
  return next;
}

export function isPositionFresh(state: QzssState, now = Date.now()) {
  if (!state.timestamp) return false;
  if (now - state.timestamp > POSITION_STALE_MS) return false;
  const { latitude, longitude } = state.position;
  if (latitude === null || longitude === null) return false;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return false;
  return true;
}

export function accuracyMetersFromState(state: QzssState) {
  if (state.accuracy.hdop !== null) return Math.max(0.5, Math.min(20, state.accuracy.hdop * 1.2));
  return 1;
}

export function qzssStateToFix(state: QzssState): Fix | null {
  if (!isPositionFresh(state) || state.signalQuality === 'none') return null;
  const { latitude, longitude } = state.position;
  if (latitude === null || longitude === null) return null;
  return {
    latitude,
    longitude,
    accuracy: accuracyMetersFromState(state),
    timestamp: state.timestamp ?? Date.now(),
    provider: 'qzss',
  };
}

export function signalQualityLabel(quality: SignalQuality) {
  switch (quality) {
    case 'excellent':
      return '● 良好';
    case 'good':
      return '● 普通';
    case 'poor':
      return '● 弱い';
    default:
      return '● 不明';
  }
}

export function signalQualityColor(quality: SignalQuality) {
  switch (quality) {
    case 'excellent':
      return '#4CAF50';
    case 'good':
      return '#FFC107';
    case 'poor':
      return '#FF9800';
    default:
      return '#9E9E9E';
  }
}

export function isWebSerialSupported() {
  return typeof navigator !== 'undefined' && 'serial' in navigator && navigator.serial !== undefined;
}

export function webSerialUnavailableMessage() {
  return 'Web Serial API はこのブラウザで使えません。Chrome または Edge を HTTPS で開いてください。';
}
