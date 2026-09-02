import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { Mission } from '@/data/missions';
import type { Fix } from '@/lib/geo';

type Props = {
  mission: Mission;
  fix: Fix | null;
  /** 目的地の正確な位置を地図上に出すか。探索中は円のみ表示して推理の余地を残す */
  revealGoal?: boolean;
  className?: string;
  interactive?: boolean;
};

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const userIcon = L.divIcon({ className: '', html: '<div class="geo-marker-user"></div>', iconSize: [22, 22], iconAnchor: [11, 11] });
const goalIcon = L.divIcon({ className: '', html: '<div class="geo-marker-goal"></div>', iconSize: [20, 20], iconAnchor: [10, 10] });

export function MissionMap({ mission, fix, revealGoal = false, className = '', interactive = true }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const accuracyRef = useRef<L.Circle | null>(null);
  const goalMarkerRef = useRef<L.Marker | null>(null);
  const goalAreaRef = useRef<L.Circle | null>(null);
  const lineRef = useRef<L.Polyline | null>(null);
  const fittedRef = useRef(false);

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
    }).setView([mission.latitude, mission.longitude], 16);
    L.tileLayer(TILE_URL, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      userMarkerRef.current = null;
      accuracyRef.current = null;
      goalMarkerRef.current = null;
      goalAreaRef.current = null;
      lineRef.current = null;
      fittedRef.current = false;
    };
  }, [interactive, mission.latitude, mission.longitude]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const goal = L.latLng(mission.latitude, mission.longitude);
    // 探索中は目的地を半径150mの「探索エリア」として表示し、正確な地点は発見後にだけ示す
    const searchRadius = revealGoal ? mission.discoveryRadius : 150;
    if (!goalAreaRef.current) {
      goalAreaRef.current = L.circle(goal, {
        radius: searchRadius,
        color: '#e47750',
        weight: 2,
        dashArray: revealGoal ? undefined : '6 6',
        fillColor: '#e47750',
        fillOpacity: 0.12,
      }).addTo(map);
    } else {
      goalAreaRef.current.setLatLng(goal).setRadius(searchRadius).setStyle({ dashArray: revealGoal ? undefined : '6 6' });
    }
    if (revealGoal) {
      if (!goalMarkerRef.current) goalMarkerRef.current = L.marker(goal, { icon: goalIcon }).addTo(map);
      else goalMarkerRef.current.setLatLng(goal);
    } else if (goalMarkerRef.current) {
      goalMarkerRef.current.remove();
      goalMarkerRef.current = null;
    }
  }, [mission, revealGoal]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!fix) {
      userMarkerRef.current?.remove();
      accuracyRef.current?.remove();
      lineRef.current?.remove();
      userMarkerRef.current = null;
      accuracyRef.current = null;
      lineRef.current = null;
      return;
    }
    const here = L.latLng(fix.latitude, fix.longitude);
    const goal = L.latLng(mission.latitude, mission.longitude);
    if (!userMarkerRef.current) userMarkerRef.current = L.marker(here, { icon: userIcon, zIndexOffset: 1000 }).addTo(map);
    else userMarkerRef.current.setLatLng(here);
    if (!accuracyRef.current) {
      accuracyRef.current = L.circle(here, { radius: fix.accuracy, color: '#1e7471', weight: 1, fillColor: '#1e7471', fillOpacity: 0.12 }).addTo(map);
    } else {
      accuracyRef.current.setLatLng(here).setRadius(fix.accuracy);
    }
    if (revealGoal) {
      if (!lineRef.current) lineRef.current = L.polyline([here, goal], { color: '#1e7471', weight: 2, dashArray: '4 8' }).addTo(map);
      else lineRef.current.setLatLngs([here, goal]);
    } else if (lineRef.current) {
      lineRef.current.remove();
      lineRef.current = null;
    }
    if (!fittedRef.current) {
      map.fitBounds(L.latLngBounds([here, goal]).pad(0.35), { maxZoom: 18 });
      fittedRef.current = true;
    }
  }, [fix, mission, revealGoal]);

  return <div ref={containerRef} className={`h-full w-full ${className}`} role="region" aria-label="探索地図" data-testid="mission-map" />;
}
