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
    id: 'kagurazaka-akagi',
    title: '石段の先の静けさ',
    name: '神楽坂の赤城神社',
    romanized: 'Akagi Shrine, Kagurazaka',
    area: '神楽坂',
    city: '東京都 新宿区',
    clue: '石段の先で、街の喧騒が一度だけ消える場所。',
    detail: 'ガラスと木でできた社殿と、静かな境内。神楽坂の路地から探してみよう。',
    latitude: 35.70338,
    longitude: 139.73652,
    discoveryRadius: 15,
    maximumAccuracy: 30,
    hints: [
      '神楽坂通りから一本入った、緩やかな坂の途中にある。',
      '赤い鳥居ではなく、ガラス張りの社殿が目印。',
      '境内のカフェの前に立つと、通りの音が遠くなる。',
    ],
    discovery: {
      headline: '街の中にひらいた、ガラスの神社。',
      story:
        '2010年に隈研吾の設計で建て替えられた社殿は、都心の神社としては珍しくガラスと木を組み合わせています。石段を上ると神楽坂通りの音がふっと遠のく。それがこの場所の一番の見どころです。',
      stamp: 'KAGURAZAKA / 01',
    },
    difficulty: 'normal',
    estimatedMinutes: 15,
    photoEnabled: true,
    published: true,
  },
  {
    id: 'imizu-kaiwomaru',
    title: '帆船が一番きれいに見える一点',
    name: '海王丸パーク',
    romanized: 'Kaiwo Maru Park, Imizu',
    area: '海王丸パーク',
    city: '富山県 射水市',
    clue: '橋と帆船と山が、ひとつの景色に重なる場所。',
    detail: '公園の中のどこかに、海王丸と新湊大橋、そして立山連峰が一枚に収まる地点がある。',
    latitude: 36.7793,
    longitude: 137.1035,
    discoveryRadius: 10,
    maximumAccuracy: 25,
    hints: [
      '船の正面ではなく、少し斜めから見る位置。',
      '岸壁沿いの手すりに近づいてみよう。',
      '橋の主塔と帆船のマストが重ならない場所。',
    ],
    discovery: {
      headline: '海の貴婦人と、日本一高い橋脚。',
      story:
        '海王丸は1930年に建造された練習帆船で、「海の貴婦人」と呼ばれています。背後の新湊大橋は日本海側最大の斜張橋。天気の良い朝は、その奥に立山連峰が並びます。',
      stamp: 'IMIZU / 01',
    },
    difficulty: 'easy',
    estimatedMinutes: 20,
    photoEnabled: true,
    published: true,
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
