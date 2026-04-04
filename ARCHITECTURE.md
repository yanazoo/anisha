# アニしゃ / AniFrame — システム設計・技術資料

## 概要

アニメ・マンガの聖地巡礼を支援するWebアプリ。
ユーザーが「あのシーンと同じ場所・構図で写真を撮る」体験を提供する。

- **国内版**: アニしゃ
- **海外版**: AniFrame
- **キャッチコピー**: あのシーンを、あなたの手で。
- **本番URL**: https://anisha-rho.vercel.app

---

## 技術スタック

| 役割 | サービス | 費用 |
|------|----------|------|
| ホスティング | Vercel | 無料枠 |
| データベース | Supabase (PostgreSQL) | 無料枠 |
| 地図 | Leaflet + OpenStreetMap | 完全無料 |
| AI解析 | Gemini API (gemini-2.0-flash) | 無料枠 |
| 座標変換 | Nominatim (OSM) | 完全無料 |
| 動画時間取得 | YouTube IFrame Player API | 無料 |
| フォント | Yomogi (Google Fonts) | 無料 |

フレームワークは使用せず、**バニラHTML/CSS/JavaScript** で構成。
サーバーサイドは Vercel Functions (Node.js) のみ。

---

## ファイル構成

```
anisha/
├── index.html          # メイン地図画面
├── register.html       # スポット登録・編集画面
├── ARCHITECTURE.md     # 本ドキュメント
└── api/
    ├── analyze.js      # Gemini API 呼び出し（画像・URL解析）
    ├── scenes.js       # Gemini API 呼び出し（YouTube動画全体解析）
    └── geocode.js      # 住所 → 座標変換（Nominatim）
```

---

## システム構成図

```
ブラウザ (index.html / register.html)
    │
    ├─── Supabase REST API ──────────────── Supabase PostgreSQL
    │        spots テーブルの読み書き
    │
    ├─── /api/scenes ────────────────────── Gemini API (Google)
    │        YouTube URL → 動画全体を解析      gemini-2.0-flash
    │        名シーン・聖地スポットを最大5件返す   fileData: video/youtube
    │
    ├─── /api/analyze ───────────────────── Gemini API (Google)
    │        画像URL / Base64 → AI解析         gemini-2.0-flash
    │        作品名・場所・エピソードを返す
    │
    ├─── /api/geocode ───────────────────── Nominatim (OpenStreetMap)
    │        住所テキスト → 緯度経度変換
    │
    ├─── YouTube IFrame Player API ─────── YouTube（クライアントサイド）
    │        動画の長さを取得して表示
    │
    └─── Leaflet.js ─────────────────────── OpenStreetMap タイル
             地図描画・ピン表示
```

---

## データベース設計

### `spots` テーブル

| カラム | 型 | 説明 |
|--------|----|------|
| `id` | UUID (PK) | 自動生成 |
| `title` | text | スポット名（例：須賀神社 階段） |
| `work` | text | 作品名（例：君の名は。） |
| `tag` | text | 作品タグ `kimi` / `slam` / `tenki` / `other` |
| `emoji` | text | ピンに表示する絵文字 |
| `lat` | float8 | 緯度 |
| `lng` | float8 | 経度 |
| `location` | text | 住所・場所名 |
| `count` | int | 再現写真の投稿数 |
| `diff` | text | 難易度（例：★★☆） |
| `ep` | text | エピソード（例：エンディング） |
| `status` | text | ステータス（後述） |
| `confidence` | int | AI解析の確信度 0〜100 |
| `discussion_url` | text | 議論URL（カンマ区切りで複数可） |
| `anime_img` | text | アニメシーン画像URL（YouTubeサムネイル等） |
| `real_img` | text | 現地写真URL（任意） |
| `created_at` | timestamp | 登録日時 |

### ステータス設計

| ステータス | 意味 | ピン表示 |
|------------|------|----------|
| `unconfirmed` | 仮登録・未確認 | 透明度45%・破線ボーダー |
| `discussing` | X(Twitter)等で議論中 | 黄色リング |
| `confirmed` | コミュニティ確定済み | 通常表示 |
| `official` | 公式認定 | 金色リング＋⭐バッジ |

### RLS ポリシー（Row Level Security）

現在は全操作を公開に設定（認証なし）:

```sql
CREATE POLICY "Public read"   ON spots FOR SELECT USING (true);
CREATE POLICY "Public insert" ON spots FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update" ON spots FOR UPDATE USING (true);
CREATE POLICY "Public delete" ON spots FOR DELETE USING (true);
```

> 将来的にはユーザー認証（Supabase Auth）と組み合わせて、
> 自分のスポットのみ編集・削除できるよう制限する。

---

## 画面・機能仕様

### index.html（地図画面）

**起動フロー**
1. スプラッシュ画面（1.5秒）表示
2. Supabase から全スポット取得
3. 地図上にピンをレンダリング
4. 全スポットが収まるようズーム調整

**主要機能**
- Leaflet + OpenStreetMap で地図表示（彩度低め・明度高めにフィルタ）
- ステータスに応じたピン表示（透明度・ボーダー色・⭐バッジ）
- 作品タグに応じたピン色分け（kimi=赤、slam=緑、tenki=紫、other=橙）
- ヘッダー検索・スライドメニュー検索（作品名・場所名・スポット名）
- 左スライドメニュー（作品別アコーディオン一覧）
- スポットタップ → ポップアップ（アニメ画像サムネイル付き）→ 詳細パネル
  - PC: 下部バー（Animeシーン と Real現地の画像ボックス）
  - SP: ボトムシート（アニメ/現地の横並び画像ストリップ）
- Google マップナビ起動
- モバイル用ドロワー（スポット一覧スワイプ）

---

### register.html（登録・編集画面）

**タブ構成**
- `新規登録` タブ：ウィザード形式
- `編集・修正` タブ：登録済みスポット一覧・編集・削除

**新規登録フロー**

```
Step1: URL入力
  ├─ YouTube URL を貼り付け → フレームプレビューを2カラムで表示
  │    ├─ サムネ（高画質 maxresdefault）
  │    ├─ フレームA（hqdefault）
  │    └─ フレーム①② （1.jpg / 2.jpg）
  │    ├─ シングルタップ: フレーム選択（解析対象）
  │    ├─ ダブルタップ: ライトボックスで拡大表示
  │    └─ YouTube IFrame API で動画時間を自動取得・表示
  ├─ 解析する時間範囲を任意で指定（開始〜終了）
  └─ または直接画像をアップロードして解析

Step2: AI解析中（ローディング表示）

Step2b: シーン選択（YouTubeの場合）
  ├─ /api/scenes が動画全体を解析（Gemini 2.5 Flash）
  ├─ 名シーン・聖地スポットを最大5件カード表示
  │    ├─ サムネイル（タイムスタンプ付き）
  │    ├─ シーン説明・推定スポット名
  │    ├─ 推定住所・確信度バッジ
  │    └─ 「動画で確認 ↗」（タイムスタンプ付きYouTubeリンク）
  └─ シーンを選択 → Step3 へ自動遷移・フォーム自動入力

  ※ シーン取得失敗・非YouTube → /api/analyze（画像解析）にフォールバック
  ※ Gemini クォータ切れ（429）→ エラーカード表示・Step1に戻れる

Step3: 確認・修正
  ├─ 作品名・スポット名・エピソード・絵文字を確認・手動修正可能
  ├─ 🎬 シーン比較カード
  │    ├─ アニメシーン：Step1で選択したフレームを表示（anime_img）
  │    │    └─ 4枚から選び直し可能（タップで変更）
  │    └─ 現地写真：URLを貼り付けてプレビュー表示（real_img）
  ├─ 場所候補を複数表示（タップで選択）
  ├─ 住所入力 → /api/geocode → 地図プレビュー
  └─ 議論URLの追加

Step4: 登録
  ├─ 仮登録（unconfirmed）：地図に薄いピンで表示
  └─ 確定登録（confirmed）：通常ピンで表示
```

---

## API 仕様

### `POST /api/scenes`

YouTube動画をGeminiで全体解析し、聖地スポットになりうるシーンを最大5件返す。

**リクエスト**
```json
{
  "url": "https://www.youtube.com/watch?v=...",
  "startTime": "1:30",
  "endTime": "5:00"
}
```
`startTime` / `endTime` は任意。指定した場合はその範囲のみ解析。

**レスポンス（成功）**
```json
{
  "scenes": [
    {
      "timestamp": 90,
      "description": "主人公が走り抜ける石畳の坂道",
      "spotName": "須賀神社 男坂",
      "location": "東京都新宿区須賀町",
      "confidence": 88,
      "emoji": "⛩️",
      "work": "君の名は。",
      "ep": "終盤・再会シーン"
    }
  ]
}
```

**レスポンス（クォータ切れ）**
```json
{ "error": "quota_exceeded", "message": "Gemini APIのクォータが上限に達しています。..." }
```

**使用モデル**: `gemini-2.0-flash`
**Gemini 機能**: `fileData: { mimeType: "video/youtube", fileUri: url }`

---

### `POST /api/analyze`

画像（URL または Base64）をGeminiで解析し、聖地情報を返す。
非YouTube URL・画像アップロード・シーン取得失敗時のフォールバックとして使用。

**リクエスト**
```json
{
  "url": "https://www.youtube.com/watch?v=...",
  "imageUrl": "https://i.ytimg.com/vi/.../maxresdefault.jpg",
  "imageBase64": "...",
  "imageMime": "image/jpeg",
  "prompt": "このアニメシーンの聖地を特定してください。..."
}
```
`imageUrl` か `imageBase64` のいずれかを使用。

**レスポンス**
```json
{
  "work": "君の名は。",
  "title": "須賀神社 階段",
  "location": "東京都新宿区須賀町",
  "ep": "エンディング",
  "confidence": 85,
  "candidates": [
    { "name": "須賀神社", "location": "東京都新宿区須賀町1-5", "confidence": 85 }
  ]
}
```

**使用モデル**: `gemini-2.0-flash`（コード内はchar配列で難読化）

---

### `GET /api/geocode`

住所テキストを緯度経度に変換する。Nominatim（OpenStreetMap）を使用。

**リクエスト**
```json
{ "address": "東京都新宿区須賀町" }
```

**レスポンス（成功）**
```json
{ "lat": "35.6844", "lng": "139.7195" }
```

---

## エラーハンドリング

| エラー | 状況 | 対処 |
|--------|------|------|
| Gemini 429（クォータ切れ） | 無料枠の1分/日上限超過 | `quota_exceeded` を返す → UIでエラーカード表示 |
| Gemini が scenes を返さない | 動画が非対応・ブロック等 | `{ scenes: [] }` → /api/analyze にフォールバック |
| Gemini が null を返す | 解析不能 | `{ work: null, title: null, ... }` の空結果 |
| geocode 失敗 | 住所不明・Nominatim 障害 | トースト通知・手動入力へ |

---

## 修正済みバグ一覧

| 問題 | 対処 |
|------|------|
| CSS変数が `var(–name)` のエンダッシュ（U+2013）でスタイル全崩れ | `var(--name)` に一括置換（index.html 113箇所、register.html 105箇所） |
| register.html にMarkdownコードフェンス（` ``` `）が混入 | 4箇所除去 |
| Gemini が `"null"` を返すと `result.work` で500クラッシュ | nullチェック追加 |
| `gemini-2.5-flash` でレート制限（429）エラー頻発 | 一時的に `gemini-2.0-flash` に変更（現在は 2.5 に戻した） |
| ピンのステータス色分けが未実装 | unconfirmed=透明、discussing=黄、official=金⭐ を実装 |
| アニメ/現地サムネイルが表示されない | anime_img / real_img カラム追加・画像比較UIを実装 |
| シーン選択後に Step1 のフレーム選択が上書きされる | selectScene() で currentAnimeImg を上書きしないよう修正 |

---

## 今後の実装計画

### 優先度：高

- [ ] **ユーザー認証**（Supabase Auth）
  - Google / X でのソーシャルログイン
  - 自分のスポットのみ編集・削除できる RLS に変更
  - 訪問記録をユーザーに紐づけ

- [ ] **マイページ**
  - 訪問スタンプ（チェックイン機能）
  - 訪問済みスポットのアルバム表示
  - 達成率・バッジ

### 優先度：中

- [ ] **シェア機能**
  - SNS投稿（OGP対応）
  - 聖地巡礼ルートのシェア（複数スポットをまとめてシェア）

- [ ] **AR構図ガイド**
  - カメラ越しにアニメシーンの構図をオーバーレイ表示
  - PWA でカメラ API 使用

- [ ] **PWA 化**
  - オフライン対応（Service Worker）
  - ホーム画面へのインストール
  - プッシュ通知（新スポット追加など）

### 優先度：低

- [ ] **多言語対応**（英語・中国語・韓国語）
  - 海外版 AniFrame ブランドと連携
  - i18n の仕組みを追加

- [ ] **AIプロバイダーの切り替え**
  - Gemini 無料枠の変更リスクに備え、Claude / HuggingFace への切り替えを想定
  - `AI_PROVIDER` 環境変数で切り替えられる設計にする

- [ ] **写真投稿機能**
  - 聖地で撮った写真をアップロード
  - `count`（再現写真数）を自動更新

- [ ] **シーンサムネイルの高画質化**
  - YouTube Data API v3 を使えば任意タイムスタンプの高解像度フレームが取得可能
  - 現状は YouTube の自動生成サムネイル（1.jpg/2.jpg 等、最大120×90）を使用

---

## 開発ガイド

### ローカル確認

```bash
# Vercel CLI でローカル起動（API含む）
npx vercel dev
```

### 環境変数

| 変数名 | 説明 | 設定場所 |
|--------|------|----------|
| `GEMINI_API_KEY` | Gemini API キー | Vercel 環境変数 |

### デプロイ

`main` ブランチへのプッシュで Vercel が自動デプロイ。

### analyze.js の難読化について

iPhone の GitHub アプリでファイルを編集すると引用符・バッククォートが特殊文字（U+2018等）に変換されてしまうため、`analyze.js` は文字列リテラルを char code 配列に置き換えた難読化コードになっている。
モデル名変更など文字列の修正は char code 値を直接変更する必要がある（例：`48`='0' → `53`='5'）。

### 注意事項

- iPhoneのGitHubアプリでのファイル編集は避ける（引用符・バッククォートが特殊文字に変換される）
- Claude Code での編集を推奨
- Supabase の anon key はクライアントに公開されているが、RLS で保護されている前提

---

## 外部サービス管理画面

| サービス | URL |
|----------|-----|
| Vercel | https://vercel.com/yanazoos-projects/anisha |
| Supabase | https://supabase.com/dashboard/project/zzpfnszijxkfxtietilr |
| GitHub | https://github.com/yanazoo/anisha |
