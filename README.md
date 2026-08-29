# GeoPuzzle

高精度位置情報を使った観光スポット探索アプリのMVP

## 機能

- 観光エリア選択（海王丸）
- 探索画面（ヒント、距離・方向表示）
- MapLibre GL JS + PMTiles による地図表示
- 発見画面（スポット情報、コレクション追加）
- コレクション画面（発見記録の表示）

## 技術スタック

- HTML5
- CSS3
- Vanilla JavaScript
- Vite
- MapLibre GL JS
- PMTiles (`pmtiles` npm package)
- localStorage (コレクション保存)

## 地図データ

地図はオンラインタイルURLではなく、ローカル配信する PMTiles を使用します。

配置先:

```text
public/maps/map.pmtiles
```

`public/maps/map.pmtiles` が存在しない場合、アプリは OpenStreetMap、Google Maps、地理院タイルなどのオンラインタイルへフォールバックしません。地図部分には PMTiles 実データが必要であることを示す案内を表示します。

## ローカル開発

依存関係をインストール:

```bash
npm install
```

開発サーバーを起動:

```bash
npm run dev
```

http://localhost:5173 にアクセスします。

PMTiles の表示確認をする場合は、実データを `public/maps/map.pmtiles` に配置してから起動してください。

## ビルド

```bash
npm run build
```

Vercel では `npm run build` を実行し、`dist` を配信します。

## プロジェクト構成

```text
GeoPuzzle/
├── index.html
├── style.css
├── app.js
├── location.js
├── config.js
├── components/
│   └── geo-map.js       # MapLibre + PMTiles 地図コンポーネント
├── public/
│   └── maps/
│       └── README.md    # map.pmtiles 配置先
├── scripts/
│   └── copy-static.mjs
├── package.json
└── vercel.json
```
