import type { Mission } from '@/data/missions';

export type Fix = {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  simulated?: boolean;
};

const EARTH_RADIUS = 6_371_000;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

export function distanceInMeters(latitude: number, longitude: number, targetLatitude: number, targetLongitude: number) {
  const latitudeDelta = toRadians(targetLatitude - latitude);
  const longitudeDelta = toRadians(targetLongitude - longitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(latitude)) * Math.cos(toRadians(targetLatitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return EARTH_RADIUS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function bearingInDegrees(latitude: number, longitude: number, targetLatitude: number, targetLongitude: number) {
  const phi1 = toRadians(latitude);
  const phi2 = toRadians(targetLatitude);
  const deltaLambda = toRadians(targetLongitude - longitude);
  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}

export function compassLabel(bearing: number) {
  const labels = ['北', '北東', '東', '南東', '南', '南西', '西', '北西'];
  return labels[Math.round(bearing / 45) % 8];
}

export function formatDistance(distance: number | null) {
  if (distance === null) return '—';
  return distance < 1000 ? `${Math.round(distance)}` : `${(distance / 1000).toFixed(1)}`;
}

export function distanceUnit(distance: number | null) {
  return distance !== null && distance >= 1000 ? 'km' : 'm';
}

export type Stage = 'unknown' | 'far' | 'approaching' | 'near' | 'search' | 'arrived';

export function stageFor(distance: number | null, mission: Mission): Stage {
  if (distance === null) return 'unknown';
  if (distance <= mission.discoveryRadius) return 'arrived';
  if (distance <= 30) return 'search';
  if (distance <= 100) return 'near';
  if (distance <= 500) return 'approaching';
  return 'far';
}

export function stageMessage(stage: Stage) {
  switch (stage) {
    case 'unknown':
      return '現在地を確認しています。';
    case 'far':
      return '手がかりを頼りに、目的地の方向へ歩いてみましょう。';
    case 'approaching':
      return '目的地に近づいています。';
    case 'near':
      return '発見地点の周辺です。手がかりと景色を照らし合わせてみましょう。';
    case 'search':
      return 'すぐ近くです。周囲を確認してください。';
    case 'arrived':
      return '発見地点に到達しました。';
  }
}

export function geolocationErrorMessage(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) return '位置情報の利用が許可されていません。ブラウザの設定から許可してください。';
  if (error.code === error.POSITION_UNAVAILABLE) return '現在地を取得できませんでした。空の見える屋外で再試行してください。';
  if (error.code === error.TIMEOUT) return '測位に時間がかかっています。もう一度現在地を更新してください。';
  return '現在地を取得できませんでした。';
}

export function fixFromPosition(position: GeolocationPosition): Fix {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
    timestamp: position.timestamp,
  };
}

/** 開発・デモ用：目的地から指定距離だけ北西に離れた地点を作る */
export function simulatedFix(mission: Mission, distance: number, accuracy: number): Fix {
  const offset = distance / Math.SQRT2;
  const latitude = mission.latitude + offset / 111_320;
  const longitude = mission.longitude - offset / (111_320 * Math.cos(toRadians(mission.latitude)));
  return { latitude, longitude, accuracy, timestamp: Date.now(), simulated: true };
}
