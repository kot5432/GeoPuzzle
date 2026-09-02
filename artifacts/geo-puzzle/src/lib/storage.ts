export const SESSION_KEY = 'geopuzzle-session';
export const USERS_KEY = 'geopuzzle-users';
export const PROGRESS_KEY = 'geopuzzle-progress';
export const ACTIVE_MISSION_KEY = 'geopuzzle-active-mission';

export type Session = { email: string; displayName: string; joinedAt: string };
export type StoredUser = { email: string; password: string; displayName: string };

export type MissionProgress = {
  hintsRevealed: number;
  verified: boolean;
  verifiedAt?: string;
  discovered: boolean;
  discoveredAt?: string;
  completed: boolean;
  completedAt?: string;
  captured: boolean;
  photo?: 'camera-frame' | 'field-note';
  lastDistance?: number;
  lastAccuracy?: number;
};

export const emptyProgress: MissionProgress = {
  hintsRevealed: 0,
  verified: false,
  discovered: false,
  completed: false,
  captured: false,
};

export const readStorage = <T,>(key: string, fallback: T): T => {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
};

export function writeStorage(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function readAllProgress() {
  return readStorage<Record<string, MissionProgress>>(PROGRESS_KEY, {});
}

export function readProgress(missionId: string): MissionProgress {
  return readAllProgress()[missionId] ?? emptyProgress;
}

export function saveProgress(missionId: string, progress: MissionProgress) {
  writeStorage(PROGRESS_KEY, { ...readAllProgress(), [missionId]: progress });
}

export function readActiveMissionId() {
  return localStorage.getItem(ACTIVE_MISSION_KEY);
}

export function saveActiveMissionId(id: string) {
  localStorage.setItem(ACTIVE_MISSION_KEY, id);
}

export function formatDate(iso: string | undefined) {
  if (!iso) return '—';
  const date = new Date(iso);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}
