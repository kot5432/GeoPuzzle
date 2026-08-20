# GeoPuzzle デプロイ手順

## 重要: みちびき受信機必須
このアプリは**みちびき受信機が必須**です。使用前に対応受信機を用意してください。

対応受信機:
- LRTK Phone 4C（レフィクシア）
- QZR-SP（JPS）
- RJCLAS-L6（小峰無線電機）
- その他Bluetooth対応NMEA出力GNSS受信機

## Supabase設定手順

### 1. Supabaseで新規プロジェクトを作成する

1. [Supabase](https://supabase.com)にアクセスし、アカウントを作成またはログイン
2. 「New Project」ボタンをクリック
3. 以下の情報を入力：
   - **Name**: プロジェクト名（例: GeoPuzzle）
   - **Database Password**: 強力なパスワードを設定（忘れないようにメモ）
   - **Region**: 最寄りのリージョンを選択（例: Tokyo for Japan）
4. 「Create new project」をクリック
5. プロジェクトの作成には約2分かかります

### 2. SQL Editorでテーブル作成SQLを実行する

1. プロジェクトダッシュボードの左メニューから「SQL Editor」をクリック
2. 「New query」をクリック
3. `DATABASE_SETUP.md`ファイル内の「テーブル作成SQL」セクションのSQLをコピー
4. SQL Editorに貼り付け
5. 右下の「Run」ボタンをクリックして実行
6. 成功すると「Success. No rows returned」と表示されます

### 3. Table Editorでテーブルを確認する

1. 左メニューから「Table Editor」をクリック
2. 以下のテーブルが作成されていることを確認：
   - `spots`
   - `photo_frames`
   - `missions`
   - `users`
   - `achievements`
   - `photo_logs`
3. 各テーブルをクリックしてカラム構成を確認
4. `spots`テーブルにサンプルデータ（海王丸）が挿入されていることを確認

### 4. RLSを有効化する

1. 再び「SQL Editor」を開く
2. 「New query」をクリック
3. `DATABASE_SETUP.md`ファイル内の「RLS有効化SQL」をコピーして実行
4. 続いて「RLSポリシー設定SQL」をコピーして実行
5. 両方のSQLが成功したことを確認

### 5. メール+パスワード認証を有効にする

1. 左メニューから「Authentication」をクリック
2. 「Providers」タブをクリック
3. 「Email」プロバイダーが有効になっていることを確認（緑色のチェックマーク）
4. 必要に応じて「Enable」をクリック

### 6. OAuth認証を有効にする（オプション）

1. 「Authentication」→「Providers」タブ
2. 「Google」プロバイダーをクリック
3. 「Enable」をクリック
4. Google Cloud ConsoleでOAuthクライアントIDを作成し、Supabaseに設定
5. 同様の手順で「GitHub」も設定可能

### 7. APIキーを取得してapp.jsに設定する

1. 左メニューから「Project Settings」→「API」をクリック
2. 以下の情報をコピー：
   - **Project URL**: `https://xxxxx.supabase.co` の形式
   - **anon public**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` の形式（JWT形式、長い文字列）
3. `app.js`ファイルを開き、先頭の定数を書き換え：

```javascript
const SUPABASE_URL = 'https://txvbafnnyxeamdhnpbsm.supabase.co'; // コピーしたProject URL
const SUPABASE_PUBLISHABLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // コピーしたanon public key
```

**重要**: `SUPABASE_PUBLISHABLE_KEY`はJWT形式（`eyJhbGci...`で始まる長い文字列）である必要があります。`sb_publishable_...`のような短い文字列ではありません。

4. ファイルを保存

## Cloudflare Pagesへのデプロイ

### 方法①: Gitを使わずzipを直接アップロードする方法

#### ファイルのzip化手順

1. `index.html`、`style.css`、`app.js`の3ファイルを選択
2. **重要**: ファイルをフォルダに入れず、直接選択すること
3. 右クリックして「送る」→「圧縮（zip形式）フォルダー」を選択
4. zipファイルの名前を`geopuzzle.zip`などに変更
5. zipファイルを展開して確認：`index.html`がzipのルート直下にあること

#### Cloudflare Pagesへのアップロード手順

1. [Cloudflare Dashboard](https://dash.cloudflare.com)にログイン
2. 左メニューから「Workers & Pages」をクリック
3. 「Create application」ボタンをクリック
4. 「Pages」タブを選択
5. 「Upload assets」をクリック
6. 「Upload files」から作成したzipファイルを選択
7. プロジェクト名を入力（例: geopuzzle）
8. 「Deploy site」をクリック
9. デプロイが完了するまで待機（約1-2分）
10. 完了するとサイトURLが表示されます（例: `https://geopuzzle.pages.dev`）

#### ファイル更新時の手順

1. ファイルを編集する
2. 再び3ファイルを選択してzip化
3. Cloudflare Pagesダッシュボードでプロジェクトを開く
4. 「Upload assets」をクリック
5. 新しいzipファイルをアップロード
6. 自動的に再デプロイが実行されます

### 方法②: GitHubリポジトリと連携してデプロイする方法

#### GitHubリポジトリの作成とファイルpush

1. [GitHub](https://github.com)にログイン
2. 右上の「+」→「New repository」をクリック
3. リポジトリ名を入力（例: GeoPuzzle）
4. 「Public」または「Private」を選択
5. 「Create repository」をクリック
6. 以下のコマンドをターミナルで実行（GeoPuzzleフォルダ内）：

```bash
git init
git add index.html style.css app.js
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/ユーザー名/GeoPuzzle.git
git push -u origin main
```

※ ユーザー名は自分のGitHubユーザー名に置き換えてください

#### Cloudflare PagesとGitHubの連携手順

1. [Cloudflare Dashboard](https://dash.cloudflare.com)にログイン
2. 左メニューから「Workers & Pages」をクリック
3. 「Create application」ボタンをクリック
4. 「Pages」タブを選択
5. 「Connect to Git」をクリック
6. GitHubアカウントと連携（初回のみ）
7. 作成したリポジトリ（GeoPuzzle）を選択
8. 以下の設定を確認：
   - **Project name**: 任意の名前（例: geopuzzle）
   - **Production branch**: main
   - **Build command**: （空欄）
   - **Build output directory**: （空欄、ルートディレクトリを指定）
9. 「Save and Deploy」をクリック
10. デプロイが完了するとサイトURLが表示されます

#### 以降の更新手順

1. ファイルを編集する
2. 以下のコマンドでGitHubにpush：

```bash
git add .
git commit -m "更新内容の説明"
git push
```

3. 自動的にCloudflare Pagesにデプロイが実行されます
4. ダッシュボードでデプロイ状況を確認できます

## どちらの方法を選ぶべきか

### zipアップロード方式のメリット
- Gitの知識が不要
- 手軽に即座にデプロイ可能
- 小規模な更新に便利

### GitHub連携方式のメリット
- バージョン管理が可能
- 自動デプロイで更新が簡単
- コラボレーションに適している
- 履歴管理やロールバックが容易

**どちらの方法を選んでも、公開されるサイトの内容は同じです。**

## デプロイ後の確認

デプロイ完了後、以下の手順で動作確認を行ってください：

1. サイトURLにアクセス
2. ログイン画面が表示されることを確認
3. 新規登録ボタンでテストユーザーを作成
4. ログインできることを確認
5. ホーム画面でスポット情報が表示されることを確認
6. 「スポットへ向かう」ボタンでナビゲーション画面へ遷移することを確認
7. 各画面の遷移と基本機能を確認
