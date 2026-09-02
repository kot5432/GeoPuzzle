export type Mission = {
  id: string;
  title: string;
  name: string;
  romanized: string;
  area: string;
  city: string;
  clue: string;
  detail: string;
  latitude: number;
  longitude: number;
  /** 発見と判定する目的地点からの距離（m） */
  discoveryRadius: number;
  /** この値より測位誤差が大きい間は到着判定を行わない（m） */
  maximumAccuracy: number;
  /** 詰まったときに順番に開放できる追加ヒント */
  hints: string[];
  discovery: {
    headline: string;
    story: string;
    stamp: string;
  };
  difficulty: 'easy' | 'normal' | 'hard';
  estimatedMinutes: number;
  photoEnabled: boolean;
  published: boolean;
};

export const missions: Mission[] = [
  {
    id: 'kosen-zaka-last-step',
    title: '最後の一歩',
    name: '高専坂',
    romanized: 'Kosen Zaka, Nagaoka National College of Technology',
    area: '長岡高専 周辺',
    city: '新潟県 長岡市',
    clue: '長岡高専へ入る前、最後に越えるものを探せ。',
    detail: '長岡高専へ入る前、最後に越えるものを探せ。ここではまだ「坂」とは言わない。',
    // ⚠️ 現地でみちびき受信機を使って一点の緯度・経度を計測してください
    latitude: 0.0000,
    longitude: 0.0000,
    // ⚠️ 坂の特定地点なら 5〜10m 推奨
    discoveryRadius: 8,
    // みちびき接続時はアプリ側で 2m に厳格化済み
    maximumAccuracy: 2,
    hints: [
      '長岡高専へ向かう道の途中にある。',
      '足元に注目して、上り下りを感じてみよう。',
      '「越える」もの。地面の傾きにヒントがある。',
      'そう、それは「坂」だ。最後に越える坂の頂点に立とう。',
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
    area: '海王丸パーク',
    city: '富山県 射水市',
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
    published: false,
  },
  {
    id: 'kaiwomaru-bell',
    title: '幸せを願う音',
    name: '幸せのベル（タイムベル）',
    romanized: 'Time Bell, Kaiwo Maru',
    area: '海王丸パーク',
    city: '富山県 射水市',
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
    published: false,
  },
  {
    id: 'kaiwomaru-lovers',
    title: 'ふたりの証を探せ',
    name: '恋人の聖地記念モニュメント',
    romanized: "Lovers' Sanctuary Monument",
    area: '海王丸パーク',
    city: '富山県 射水市',
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
    published: false,
  },
];

export const publishedMissions = missions.filter((mission) => mission.published);

export function findMission(id: string | null | undefined): Mission {
  return publishedMissions.find((mission) => mission.id === id) ?? publishedMissions[0];
}

export function missionIndex(mission: Mission) {
  return publishedMissions.findIndex((candidate) => candidate.id === mission.id);
}

export function missionLabel(mission: Mission) {
  return `mission ${String(missionIndex(mission) + 1).padStart(2, '0')} / ${String(publishedMissions.length).padStart(2, '0')}`;
}
