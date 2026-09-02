/* ============================================
   GeoPuzzle のデータ階層
   Region（地域/県市） → Area（探索エリア） → Mission（ミッション） → Discovery（発見地点・名前）
   ユーザーには「発見」するまで Area と Mission の「名前・場所」は原則非公開。
   ============================================ */

export type Mission = {
  id: string;
  /** ユーザーに表示するミッションタイトル。謎解きのヒントになる範囲で命名。 */
  title: string;
  /** 「場所」の名前。発見するまでユーザーには表示しない。 */
  name: string;
  romanized: string;
  /** 所属する探索エリアID（areas のキー）。 */
  areaId: string;
  /** 所属する地域ID（regions のキー）。 */
  regionId: string;
  /** 探索時の手がかり。 */
  clue: string;
  /** ミッション詳細文（探索ページの補足）。 */
  detail: string;
  /** 発見地点の緯度経度（発見するまで非公開）。 */
  latitude: number;
  longitude: number;
  /** 発見と判定する目的地点からの距離（m） */
  discoveryRadius: number;
  /** この値より測位誤差が大きい間は到着判定を行わない（m） */
  maximumAccuracy: number;
  /** 詰まったときに順番に開放できる追加ヒント */
  hints: string[];
  discovery: {
    /** 発見後に表示する「場所の名前」を含む見出し。 */
    headline: string;
    story: string;
    stamp: string;
  };
  difficulty: 'easy' | 'normal' | 'hard';
  estimatedMinutes: number;
  photoEnabled: boolean;
  published: boolean;
};

/** 探索エリア（例：海王丸パーク、長岡高専周辺、新湊エリア） */
export type Area = {
  id: string;
  /** ユーザーに表示するエリア名。 */
  name: string;
  /** 所属する地域ID。 */
  regionId: string;
  /** エリアの代表座標（地域地図の表示位置などで使用）。 */
  latitude: number;
  longitude: number;
  /** 地域内での表示順。 */
  order: number;
};

/** 地域（例：新潟県長岡市、富山県射水市）。ホーム画面で一覧に表示する単位。 */
export type Region = {
  id: string;
  /** 都道府県込みの正式名（例：新潟県 長岡市）。 */
  name: string;
  /** 短い市区町村名（カードなどに表示）。 */
  shortName: string;
  /** 紹介文（任意）。 */
  tagline: string;
  /** 代表点の緯度経度（現在地からの距離計算などに使う）。 */
  latitude: number;
  longitude: number;
  /** 新規解放済みか、コミングスーンか。 */
  status: 'available' | 'coming-soon';
  /** ホームでの表示順。 */
  order: number;
};

export const regions: Region[] = [
  {
    id: 'nagaoka',
    name: '新潟県 長岡市',
    shortName: '長岡市',
    tagline: '自然と文化が広がるまち',
    latitude: 37.532,
    longitude: 138.869,
    status: 'available',
    order: 1,
  },
  {
    id: 'imizu',
    name: '富山県 射水市',
    shortName: '射水市',
    tagline: '海王丸と、立山の向こう側。',
    latitude: 36.781,
    longitude: 137.108,
    status: 'available',
    order: 2,
  },
  {
    id: 'kanazawa',
    name: '石川県 金沢市',
    shortName: '金沢市',
    tagline: '城下町の路地裏に隠れた、まだ見ぬ景色。',
    latitude: 36.561,
    longitude: 136.656,
    status: 'coming-soon',
    order: 3,
  },
  {
    id: 'toyama',
    name: '富山県 富山市',
    shortName: '富山市',
    tagline: '立山を真下に望む、市街地の一点。',
    latitude: 36.696,
    longitude: 137.214,
    status: 'coming-soon',
    order: 4,
  },
];

export const areas: Area[] = [
  { id: 'nagaoka-kosen', name: '長岡高専 周辺', regionId: 'nagaoka', latitude: 37.5333, longitude: 138.8710, order: 1 },
  { id: 'kaiwomaru-park', name: '海王丸パーク', regionId: 'imizu', latitude: 36.7812, longitude: 137.1075, order: 1 },
  { id: 'shinminato', name: '新湊エリア', regionId: 'imizu', latitude: 36.783, longitude: 137.109, order: 2 },
];

export const missions: Mission[] = [
  {
    id: 'kosen-zaka-last-step',
    title: '最後の一歩',
    name: '高専坂',
    romanized: 'Kosen Zaka, Nagaoka National College of Technology',
    areaId: 'nagaoka-kosen',
    regionId: 'nagaoka',
    clue: '長岡高専へ入る前、最後に越えるものを探せ。',
    detail: '長岡高専へ入る前、最後に越えるものを探せ。',
    latitude: 37.433545,
    longitude: 138.889327,
    discoveryRadius: 8,
    maximumAccuracy: 2,
    hints: [
      '地面に注目してみよう。',
      '学校へ近づくにつれて、少しずつ高くなっていく。',
      '学校へ向かう途中、歩いていると自然と上へ進んでいく場所がある。',
      '学校の入口へ向かう坂を探してみよう。',
    ],
    discovery: {
      headline: 'あなたが探していたのは、高専坂。',
      story:
        '長岡高専へ向かう「最後の一歩」を見つけました。毎日の通学の中で、何気なく越えてきたこの坂が、あなただけの発見ポイントです。',
      stamp: '最後の一歩',
    },
    difficulty: 'easy',
    estimatedMinutes: 10,
    photoEnabled: true,
    published: true,
  },
  {
    id: 'kaiwomaru-viewpoint',
    title: '4つの景色が重なる場所',
    name: '展望広場',
    romanized: 'Observation Plaza, Kaiwo Maru Park',
    areaId: 'kaiwomaru-park',
    regionId: 'imizu',
    clue: '海・山・橋・船。すべてが見える「一点」を探そう。',
    detail: '公園の中のどこかに、富山湾・立山連峰・新湊大橋・帆船海王丸が一枚に収まる地点がある。',
    latitude: 36.7813,
    longitude: 137.1076,
    discoveryRadius: 10,
    maximumAccuracy: 25,
    hints: [
      '4つが同時に見える場所を探してみよう。',
      '海を正面にして、周りを見渡してみよう。',
      '少し高い場所から、船と橋を一緒に探そう。',
      '4つの景色が重なる場所に立ってみよう。',
    ],
    discovery: {
      headline: '富山湾、立山連峰、新湊大橋、帆船海王丸を一望できる場所。',
      story:
        '海王丸は1930年に建造された練習帆船で、「海の貴婦人」と呼ばれています。背後の新湊大橋は日本海側最大の斜張橋。天気の良い朝は、その奥に立山連峰が並び、海・山・橋・船がひとつの景色に重なります。',
      stamp: '絶景発見者',
    },
    difficulty: 'easy',
    estimatedMinutes: 15,
    photoEnabled: true,
    published: true,
  },
  {
    id: 'kaiwomaru-bell',
    title: '幸せを願う音',
    name: '幸せのベル（タイムベル）',
    romanized: 'Time Bell, Kaiwo Maru',
    areaId: 'kaiwomaru-park',
    regionId: 'imizu',
    clue: '船の中にある、願いを託せる音を探そう。',
    detail: '海王丸の船内には、時間を知らせるために使われてきた音がある。',
    latitude: 36.7812,
    longitude: 137.1075,
    discoveryRadius: 10,
    maximumAccuracy: 25,
    hints: [
      '海王丸の中を探してみよう。',
      '時間を知らせるために使われるものを探そう。',
      '船の中にある、大きなベルを探そう。',
      'ベルの前で、願いを託してみよう。',
    ],
    discovery: {
      headline: '海王丸の船内にある、時間を知らせるためのベル。',
      story:
        '帆船では30分ごとにベルを鳴らして時刻を知らせてきました。海王丸のタイムベルは「幸せのベル」とも呼ばれ、鳴らすと願いがかなうと言われています。',
      stamp: '幸せの鐘',
    },
    difficulty: 'normal',
    estimatedMinutes: 20,
    photoEnabled: true,
    published: true,
  },
  {
    id: 'kaiwomaru-lovers',
    title: 'ふたりの証を探せ',
    name: '恋人の聖地記念モニュメント',
    romanized: "Lovers' Sanctuary Monument",
    areaId: 'kaiwomaru-park',
    regionId: 'imizu',
    clue: '恋人たちの場所であることを示す、特別な証を探そう。',
    detail: '海王丸パークには、特別に選ばれた場所であることを示すモニュメントがある。',
    latitude: 36.7811,
    longitude: 137.1074,
    discoveryRadius: 10,
    maximumAccuracy: 25,
    hints: [
      '海王丸パークには、特別に選ばれた場所がある。',
      'ふたりの思い出を残したくなるものを探そう。',
      '恋人たちの場所を示すものを探そう。',
      'その証の前に立ってみよう。',
    ],
    discovery: {
      headline: '海王丸パークにある、恋人の聖地に選定されたことを示すモニュメント。',
      story:
        '海王丸パークは「恋人の聖地」に選定されています。帆船と橋を背景にしたこのモニュメントの前は、ふたりの記念写真の定番スポットです。',
      stamp: '愛の聖地',
    },
    difficulty: 'normal',
    estimatedMinutes: 15,
    photoEnabled: true,
    published: true,
  },
];

/* ---------- 導出 ---------- */

export const publishedMissions = missions.filter((mission) => mission.published);

export function findMission(id: string | null | undefined): Mission {
  return publishedMissions.find((mission) => mission.id === id) ?? publishedMissions[0];
}

/** 地域を ID で引く。 */
export function findRegion(id: string | null | undefined): Region | null {
  return regions.find((r) => r.id === id) ?? null;
}

/**
 * 地域IDに属するパブリッシュ済みミッション一覧。
 * ユーザーに表示するタイミングでは原則として mission.name は使用禁止。
 */
export function missionsByRegion(regionId: string): Mission[] {
  return publishedMissions.filter((m) => m.regionId === regionId);
}

/** 指定された地域に含まれるエリア一覧。 */
export function areasByRegion(regionId: string): Area[] {
  return areas.filter((a) => a.regionId === regionId).sort((a, b) => a.order - b.order);
}

/**
 * 地域内でのミッション連番。
 * 「MISSION 01 / 04」 のような地域単位のラベルを作るために使う。
 */
export function missionIndexInRegion(mission: Mission): number {
  const list = missionsByRegion(mission.regionId);
  return list.findIndex((candidate) => candidate.id === mission.id);
}

export function missionLabel(mission: Mission): string {
  const list = missionsByRegion(mission.regionId);
  const i = list.findIndex((candidate) => candidate.id === mission.id) + 1;
  return `mission ${String(i).padStart(2, '0')} / ${String(list.length).padStart(2, '0')}`;
}

/** 地域IDから「地域内のミッション総数」と「達成済み数」を返す。 */
export function regionMissionStats(regionId: string, allProgress: Record<string, { discovered?: boolean; completed?: boolean }>): { total: number; discovered: number; completed: number } {
  const list = missionsByRegion(regionId);
  let discovered = 0;
  let completed = 0;
  for (const m of list) {
    const p = allProgress[m.id];
    if (p?.discovered) discovered += 1;
    if (p?.completed) completed += 1;
  }
  return { total: list.length, discovered, completed };
}

/** ユーザーの現在地（Fix or 代表座標）から最も近い利用可能な地域を1つ返す。 */
export function nearestRegion(fix: { latitude: number; longitude: number } | null): Region {
  const available = regions.filter((r) => r.status === 'available');
  if (!available.length) return regions[0];
  if (!fix) return available[0];
  const R = 6371;
  const toRad = (v: number) => (v * Math.PI) / 180;
  let best = available[0];
  let bestDist = Infinity;
  for (const r of available) {
    const dLat = toRad(r.latitude - fix.latitude);
    const dLon = toRad(r.longitude - fix.longitude);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(fix.latitude)) * Math.cos(toRad(r.latitude)) * Math.sin(dLon / 2) ** 2;
    const d = 2 * R * Math.asin(Math.sqrt(a));
    if (d < bestDist) {
      bestDist = d;
      best = r;
    }
  }
  return best;
}
