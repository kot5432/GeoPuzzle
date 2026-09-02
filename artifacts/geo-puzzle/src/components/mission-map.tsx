import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import type { Mission, Region } from '@/data/missions';
import type { Fix } from '@/lib/geo';

type SingleMissionProps = {
  mode?: 'single';
  mission: Mission;
  fix: Fix | null;
  revealGoal?: boolean;
  className?: string;
  interactive?: boolean;
};

type RegionOverviewProps = {
  mode: 'region';
  /** 地域情報（地図の初期表示位置を決める） */
  region: Region;
  /** 地域内のミッション一覧。「発見」するまで mission.name は使わない。 */
  missions: Array<{
    mission: Mission;
    /** 地域内での連番（1始まり） */
    index: number;
    /** ユーザーの進行状況 */
    state: 'undiscovered' | 'discovered' | 'completed';
    /** クリック時のコールバック */
    onSelect?: () => void;
  }>;
  fix?: Fix | null;
  className?: string;
  interactive?: boolean;
  /** カード用地図のコンパクトモード（ラベルなし、シンプルなピン） */
  compact?: boolean;
  /** 地域範囲表示モード（ミッションピンではなく地域境界を表示） */
  showAreaOnly?: boolean;
};

export type MissionMapProps = SingleMissionProps | RegionOverviewProps;

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const userIcon = (provider?: Fix['provider']) =>
  L.divIcon({
    className: '',
    html: `<div class="geo-marker-user${provider === 'qzss' ? ' is-qzss' : ''}"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
const goalIcon = L.divIcon({ className: '', html: '<div class="geo-marker-goal"></div>', iconSize: [20, 20], iconAnchor: [10, 10] });

/** 地域モードで使うミッションノード。ピンの下にラベル（MISSION 01 / タイトル）を付ける */
function missionNodeIcon(index: number, title: string, state: 'undiscovered' | 'discovered' | 'completed', compact = false) {
  const pinColor = state === 'undiscovered' ? '#e47750' : state === 'discovered' ? '#e4a850' : '#1e7471';
  const ringColor =
    state === 'undiscovered' ? 'rgba(228, 119, 80, 0.28)' : state === 'discovered' ? 'rgba(228, 168, 80, 0.32)' : 'rgba(30, 116, 113, 0.32)';
  const labelText = state === 'undiscovered' && index > 1 ? '？？？' : title;
  
  if (compact) {
    // コンパクト版：カード用地図用（ラベルなし、シンプルなピン）
    const node = document.createElement('div');
    node.style.display = 'flex';
    node.style.alignItems = 'center';
    node.style.justifyContent = 'center';
    node.style.width = '32px';
    node.style.height = '32px';
    node.style.marginLeft = '-16px';
    node.style.marginTop = '-16px';
    node.innerHTML = `
      <div style="position:relative;width:24px;height:24px;">
        <div style="position:absolute;inset:-4px;border-radius:999px;background:${ringColor};"></div>
        <div style="position:absolute;inset:2px;border-radius:999px;background:${pinColor};border:3px solid #fff;box-shadow:0 2px 6px rgba(23,54,64,.25);"></div>
      </div>
    `;
    return L.divIcon({
      className: '',
      html: node,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
  }
  
  // 通常版：地域マップ用
  const node = document.createElement('div');
  node.style.display = 'flex';
  node.style.flexDirection = 'column';
  node.style.alignItems = 'center';
  node.style.gap = '4px';
  node.style.width = '160px';
  node.style.marginLeft = '-80px';
  node.innerHTML = `
    <div style="position:relative;width:24px;height:24px;">
      <div style="position:absolute;inset:-6px;border-radius:999px;background:${ringColor};"></div>
      <div style="position:absolute;inset:2px;border-radius:999px;background:${pinColor};border:3px solid #fff;box-shadow:0 2px 6px rgba(23,54,64,.25);"></div>
    </div>
    <div style="display:flex;flex-direction:column;align-items:center;gap:1px;background:rgba(244,240,230,.92);backdrop-filter:blur(4px);padding:4px 8px;border-radius:10px;border:1px solid rgba(215,207,188,.8);max-width:100%;">
      <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:9px;letter-spacing:.18em;color:#668078;text-transform:uppercase;">Mission ${String(index).padStart(2, '0')}</div>
      <div style="font-size:12px;font-weight:800;line-height:1.25;color:#173640;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:144px;">${labelText}</div>
    </div>
  `;
  return L.divIcon({
    className: '',
    html: node,
    iconSize: [160, 80],
    iconAnchor: [80, 12],
  });
}

export function MissionMap(props: MissionMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const mode = props.mode ?? 'single';

  const interactive = 'interactive' in props ? (props.interactive ?? true) : true;
  const className = 'className' in props ? (props.className ?? '') : '';

  const singleMission = useMemo<Mission | null>(() => (mode === 'single' ? props.mission : null), [mode, props]);

  const compactMode = mode === 'region' ? (props as RegionOverviewProps).compact ?? false : false;
  const showAreaOnly = mode === 'region' ? (props as RegionOverviewProps).showAreaOnly ?? false : false;

  const initialCenter: L.LatLngTuple = useMemo(() => {
    if (mode === 'region') return [props.region.latitude, props.region.longitude];
    return [singleMission!.latitude, singleMission!.longitude];
  }, [mode, props, singleMission]);

  const initialZoom = mode === 'region' ? (compactMode ? 12 : (showAreaOnly ? 13 : 14)) : 16;

  /* ---------- マウント ---------- */
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      zoomControl: interactive,
      dragging: interactive,
      scrollWheelZoom: interactive,
      touchZoom: interactive,
      doubleClickZoom: interactive,
      boxZoom: interactive,
      keyboard: interactive,
      attributionControl: true,
    }).setView(initialCenter, initialZoom);
    L.tileLayer(TILE_URL, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // initialCenter / zoom / interactive はマウント時にしか使わない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- Single mission モードの描画 ---------- */
  const singleRefs = useRef<{
    userMarker: L.Marker | null;
    accuracy: L.Circle | null;
    goalMarker: L.Marker | null;
    goalArea: L.Circle | null;
    line: L.Polyline | null;
    fitted: boolean;
  }>({ userMarker: null, accuracy: null, goalMarker: null, goalArea: null, line: null, fitted: false });

  useEffect(() => {
    if (mode !== 'single') return;
    const map = mapRef.current;
    if (!map || !singleMission) return;
    const revealGoal = props.revealGoal ?? false;
    const goal = L.latLng(singleMission.latitude, singleMission.longitude);
    const searchRadius = revealGoal ? singleMission.discoveryRadius : 150;
    if (!singleRefs.current.goalArea) {
      singleRefs.current.goalArea = L.circle(goal, {
        radius: searchRadius,
        color: '#e47750',
        weight: 2,
        dashArray: revealGoal ? undefined : '6 6',
        fillColor: '#e47750',
        fillOpacity: 0.12,
      }).addTo(map);
    } else {
      singleRefs.current.goalArea
        .setLatLng(goal)
        .setRadius(searchRadius)
        .setStyle({ dashArray: revealGoal ? undefined : '6 6' });
    }
    if (revealGoal) {
      if (!singleRefs.current.goalMarker) singleRefs.current.goalMarker = L.marker(goal, { icon: goalIcon }).addTo(map);
      else singleRefs.current.goalMarker.setLatLng(goal);
    } else if (singleRefs.current.goalMarker) {
      singleRefs.current.goalMarker.remove();
      singleRefs.current.goalMarker = null;
    }
  }, [mode, singleMission, props]);

  useEffect(() => {
    if (mode !== 'single') return;
    const map = mapRef.current;
    if (!map || !singleMission) return;
    const fix = (props as SingleMissionProps).fix ?? null;
    const r = singleRefs.current;
    if (!fix) {
      r.userMarker?.remove();
      r.accuracy?.remove();
      r.line?.remove();
      r.userMarker = null;
      r.accuracy = null;
      r.line = null;
      return;
    }
    const here = L.latLng(fix.latitude, fix.longitude);
    const goal = L.latLng(singleMission.latitude, singleMission.longitude);
    const markerColor = fix.provider === 'qzss' ? '#e05c35' : '#1e7471';
    if (!r.userMarker) r.userMarker = L.marker(here, { icon: userIcon(fix.provider), zIndexOffset: 1000 }).addTo(map);
    else {
      r.userMarker.setLatLng(here);
      r.userMarker.setIcon(userIcon(fix.provider));
    }
    if (!r.accuracy) {
      r.accuracy = L.circle(here, { radius: fix.accuracy, color: markerColor, weight: 1, fillColor: markerColor, fillOpacity: 0.12 }).addTo(map);
    } else {
      r.accuracy.setLatLng(here).setRadius(fix.accuracy).setStyle({ color: markerColor, fillColor: markerColor });
    }
    const revealGoal = props.revealGoal ?? false;
    if (revealGoal) {
      if (!r.line) r.line = L.polyline([here, goal], { color: '#1e7471', weight: 2, dashArray: '4 8' }).addTo(map);
      else r.line.setLatLngs([here, goal]);
    } else if (r.line) {
      r.line.remove();
      r.line = null;
    }
    if (!r.fitted) {
      map.fitBounds(L.latLngBounds([here, goal]).pad(0.35), { maxZoom: 18 });
      r.fitted = true;
    }
  }, [mode, singleMission, props]);

  /* ---------- Region overview モードの描画 ---------- */
  const regionRefs = useRef<{
    userMarker: L.Marker | null;
    accuracy: L.Circle | null;
    missionMarkers: Map<string, L.Marker>;
    areaCircle: L.Circle | null;
    fitted: boolean;
  }>({ userMarker: null, accuracy: null, missionMarkers: new Map(), areaCircle: null, fitted: false });

  useEffect(() => {
    if (mode !== 'region') return;
    const map = mapRef.current;
    if (!map) return;
    
    // 地域範囲表示モードの場合はミッションピンを表示しない
    if (showAreaOnly) {
      // 地域円を表示
      const center: L.LatLngTuple = [(props as RegionOverviewProps).region.latitude, (props as RegionOverviewProps).region.longitude];
      const radius = 2000; // 地域の半径（2km）
      
      if (!regionRefs.current.areaCircle) {
        regionRefs.current.areaCircle = L.circle(center, {
          radius: radius,
          color: '#1e7471',
          weight: 2,
          dashArray: '8 8',
          fillColor: '#1e7471',
          fillOpacity: 0.08,
        }).addTo(map);
      } else {
        regionRefs.current.areaCircle.setLatLng(center).setRadius(radius);
      }
      
      // ミッションマーカーをすべて削除
      for (const [id, marker] of regionRefs.current.missionMarkers) {
        marker.remove();
        regionRefs.current.missionMarkers.delete(id);
      }
      
      // 地図を地域中心に設定
      if (!regionRefs.current.fitted) {
        map.setView(center, 13);
        regionRefs.current.fitted = true;
      }
      return;
    }
    
    // 通常のミッションピン表示モード
    const entries = (props as RegionOverviewProps).missions;
    const validIds = new Set<string>();
    const bounds: L.LatLngTuple[] = [];
    for (const entry of entries) {
      validIds.add(entry.mission.id);
      const position: L.LatLngTuple = [entry.mission.latitude, entry.mission.longitude];
      bounds.push(position);
      const existing = regionRefs.current.missionMarkers.get(entry.mission.id);
      const icon = missionNodeIcon(entry.index, entry.mission.title, entry.state, compactMode);
      if (!existing) {
        const marker = L.marker(position, { icon }).addTo(map);
        if (typeof entry.onSelect === 'function') {
          marker.on('click', entry.onSelect);
        }
        regionRefs.current.missionMarkers.set(entry.mission.id, marker);
      } else {
        existing.setLatLng(position);
        existing.setIcon(icon);
        existing.off('click');
        if (typeof entry.onSelect === 'function') {
          existing.on('click', entry.onSelect);
        }
      }
    }
    for (const [id, marker] of regionRefs.current.missionMarkers) {
      if (!validIds.has(id)) {
        marker.remove();
        regionRefs.current.missionMarkers.delete(id);
      }
    }
    // 地域円を削除
    if (regionRefs.current.areaCircle) {
      regionRefs.current.areaCircle.remove();
      regionRefs.current.areaCircle = null;
    }
    if (!regionRefs.current.fitted && bounds.length) {
      const fix = (props as RegionOverviewProps).fix ?? null;
      if (fix) bounds.push([fix.latitude, fix.longitude]);
      if (bounds.length === 1) map.setView(bounds[0], 16);
      else map.fitBounds(L.latLngBounds(bounds).pad(0.45), { maxZoom: 17 });
      regionRefs.current.fitted = true;
    }
  }, [mode, props, compactMode, showAreaOnly]);

  useEffect(() => {
    if (mode !== 'region') return;
    const map = mapRef.current;
    if (!map) return;
    const fix = (props as RegionOverviewProps).fix ?? null;
    const r = regionRefs.current;
    if (!fix) {
      r.userMarker?.remove();
      r.accuracy?.remove();
      r.userMarker = null;
      r.accuracy = null;
      return;
    }
    const here = L.latLng(fix.latitude, fix.longitude);
    const markerColor = fix.provider === 'qzss' ? '#e05c35' : '#1e7471';
    if (!r.userMarker) r.userMarker = L.marker(here, { icon: userIcon(fix.provider), zIndexOffset: 1000 }).addTo(map);
    else {
      r.userMarker.setLatLng(here);
      r.userMarker.setIcon(userIcon(fix.provider));
    }
    if (!r.accuracy) {
      r.accuracy = L.circle(here, { radius: fix.accuracy, color: markerColor, weight: 1, fillColor: markerColor, fillOpacity: 0.12 }).addTo(map);
    } else {
      r.accuracy.setLatLng(here).setRadius(fix.accuracy).setStyle({ color: markerColor, fillColor: markerColor });
    }
  }, [mode, props]);

  return <div ref={containerRef} className={`h-full w-full ${className}`} role="region" aria-label={mode === 'region' ? '地域探索地図' : '探索地図'} data-testid="mission-map" />;
}
