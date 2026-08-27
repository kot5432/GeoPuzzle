# GeoPuzzle

高精度位置情報を使った観光スポット探索アプリのMVP

## 機能

- 観光エリア選択（海王丸）
- 探索画面（ヒント、距離・方向表示）
- 発見画面（スポット情報、コレクション追加）
- コレクション画面（発見記録の表示）

## 技術スタック

- HTML5
- CSS3
- Vanilla JavaScript
- Supabase (認証)
- localStorage (コレクション保存)

## デプロイ

### ローカル開発

```bash
python -m http.server 8000
```

http://localhost:8000 にアクセス

### Vercelデプロイ

静的ファイルとしてデプロイされます。GitHubにプッシュすると自動的にVercelがデプロイします。

## プロジェクト構成

```
GeoPuzzle/
├── index.html      # メインHTML
├── style.css       # スタイルシート
├── app.js          # アプリケーションロジック
├── package.json    # プロジェクト設定
├── vercel.json     # Vercel設定
└── .vercelignore   # Vercel除外ファイル
```

## 開発

認証を使用するには、`app.js`のSupabase設定を更新してください。
