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
| データベース・認証 | Supabase (PostgreSQL + Auth) | 無料枠（MAU 5万人、DB 500MB） |
| 地図 | Leaflet + OpenStreetMap | 完全無料 |
| AI解析（主） | Groq API（LLaMA 4 Maverick） | 無料枠（1日14,400リクエスト） |
| AI解析（副） | Gemini API（gemini-2.0-flash） | 無料枠（1日1,500リクエスト） |
| 座標変換 | Nominatim (OSM) | 完全無料 |
| 現地写真取得 | Wikipedia / Wikimedia Commons Geosearch API | 完全無料 |
| フレーム抽出 | YouTube Storyboard API（内部） | 完全無料 |
| 動画時間取得 | YouTube IFrame Player API | 無料 |
| 動画タイトル取得 | YouTube oEmbed API | 完全無料 |
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
    ├── analyze.js      # AI画像解析（Groq primary + Gemini fallback）
    ├── frame.js        # YouTube指定時刻フレーム取得（Storyboard API）
    ├── photos.js       # 現地写真取得（Wikipedia / Wikimedia Commons）
    ├── scenes.js       # YouTube動画全体解析（Gemini、現在は未使用）
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
    ├─── Supabase Auth ──────────────────── Supabase Auth
    │        Google OAuth ログイン            （Google Provider）
    │        セッション管理・JWT発行
    │
    ├─── /api/analyze ───────────────────── Groq API（primary）
    │        画像URL / Base64 → AI解析         LLaMA 4 Maverick
    │        作品名・場所・エピソードを返す      + Gemini fallback
    │
    ├─── /api/frame ─────────────────────── YouTube Storyboard API
    │        videoId + seconds               任意秒数のフレーム画像を取得
    │        → 指定時刻のフレームをBase64で返す  sharp（unavailable時はcanvas）
    │
    ├─── /api/photos ────────────────────── Wikipedia Geosearch API
    │        lat + lng → 周辺写真             ja → en → Wikimedia Commons
    │        半径3km以内のWikipedia記事の        の順でフォールバック
    │        サムネイル画像を最大12件返す
    │
    ├─── /api/geocode ───────────────────── Nominatim (OpenStreetMap)
    │        住所テキスト → 緯度経度変換
    │
    ├─── YouTube oEmbed API ─────────────── YouTube（外部API）
    │        videoId → 動画タイトル取得（作品名ヒント）
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
| `user_id` | uuid | 登録ユーザーID（Supabase Auth の user.id） |
| `created_at` | timestamp | 登録日時 |

### ステータス設計

| ステータス | 意味 | ピン表示 |
|------------|------|----------|
| `unconfirmed` | 仮登録・未確認 | 透明度45%・破線ボーダー |
| `discussing` | X(Twitter)等で議論中 | 黄色リング |
| `confirmed` | コミュニティ確定済み | 通常表示 |
| `official` | 公式認定 | 金色リング＋⭐バッジ |

### RLS ポリシー（Row Level Security）

現在は全操作を公開に設定（後方互換のため）:

```sql
CREATE POLICY "Public read"   ON spots FOR SELECT USING (true);
CREATE POLICY "Public insert" ON spots FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update" ON spots FOR UPDATE USING (true);
CREATE POLICY "Public delete" ON spots FOR DELETE USING (true);
```

> 今後の方針：ログインユーザーのJWT（access_token）を INSERT/PATCH/DELETE 時に使用し、
> RLS を「認証済みユーザーのみ書き込み可・自分のスポットのみ編集可」に変更する。

---

## 認証設計（Supabase Auth）

### 概要

- **SDKバージョン**: `@supabase/supabase-js@2`（CDNで読み込み）
- **対応プロバイダー**: Google OAuth
- **セッション管理**: Supabase JS SDK が localStorage で自動管理

### 初期化

```javascript
const sbClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let currentUser = null;

sbClient.auth.onAuthStateChange((event, session) => {
  currentUser = session?.user || null;
  updateAuthUI();
});
```

### ログイン・ログアウト

```javascript
// Googleログイン
await sbClient.auth.signInWithOAuth({
  provider: 'google',
  options: { redirectTo: window.location.origin + '/' }
});

// ログアウト
await sbClient.auth.signOut();
```

### UI

**index.html**
- ヘッダー右端：未ログイン → 「ログイン」ボタン、ログイン済み → アバター画像
- ログインモーダル：Googleログインボタン、ユーザー情報、ログアウトボタン
- スライドメニュー下部：ユーザー情報＋ログアウトボタン
- ＋登録ボタン：`requireAuthThen()` でログイン必須に

**register.html**
- 未ログイン時：全画面ログインゲートを表示
- ログイン後：ヘッダーにアバター＋ユーザー名（タップでログアウト）
- spots 登録時：`user_id: currentUser?.id` を付与

### Supabase Dashboard 設定（初回のみ）

1. Authentication → Providers → **Google** を有効化
   - Google Cloud Console で OAuth クライアントID・Secretを取得
   - リダイレクトURI: `https://zzpfnszijxkfxtietilr.supabase.co/auth/v1/callback`
2. Authentication → URL Configuration
   - Site URL: `https://anisha-rho.vercel.app`
   - Redirect URLs: `https://anisha-rho.vercel.app`, `https://anisha-rho.vercel.app/register.html`
3. spots テーブルに `user_id uuid nullable` カラムを追加

---

## 画面・機能仕様

### index.html（地図画面）

**起動フロー**
1. スプラッシュ画面（1.5秒）表示
2. Supabase から全スポット取得
3. 地図上にピンをレンダリング
4. URLパラメータ `?zLat=&zLng=` があれば → 全体表示後に該当ピンへ `flyTo` アニメーション（2.2秒）→ ポップアップ自動表示
5. パラメータなしの場合 → 全スポットが収まるようズーム調整

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
- ログイン/ログアウト UI（ヘッダー＋スライドメニュー）

---

### register.html（登録・編集画面）

**タブ構成**
- `新規登録` タブ：ウィザード形式
- `編集・修正` タブ：登録済みスポット一覧・編集・削除

**アクセス制限**
- 未ログイン時は全画面ログインゲートを表示
- ログイン後のみ登録・編集が可能

**新規登録フロー**

```
Step1: URL入力 + 作品情報入力
  ├─ URL貼り付け → YouTube判定
  │
  ├─ 📝 作品情報入力エリア（URL入力後に表示）
  │    ├─ 作品名（YouTube oEmbedで自動取得・修正可）
  │    ├─ シーン名（任意）
  │    └─ 追加情報・ヒント（任意：「京都の神社」等）
  │         → これらはAIプロンプトに最優先情報として渡す
  │
  ├─ 🎬 解析フレームを選択（YouTube URL貼り付け後に表示）
  │    ├─ サムネ（maxresdefault）
  │    ├─ フレームA（動画25%地点）▶ MM:SS バッジ表示
  │    ├─ フレームB（動画50%地点）▶ MM:SS バッジ表示
  │    ├─ フレームC（動画75%地点）▶ MM:SS バッジ表示
  │    └─ 指定時刻フレーム（時間入力時に自動追加）
  │         ├─ シングルタップ: フレーム選択（解析対象）
  │         ├─ ダブルタップ: ライトボックスで拡大表示
  │         └─ YouTube IFrame API で動画時間を自動取得・表示
  │
  ├─ ⏱ 解析する時間範囲（任意）
  │    ├─ 開始時間を入力（MM:SS 形式）
  │    │    → 600ms debounce で /api/frame を呼び出し
  │    │    → 指定時刻の実フレームを取得して「指定時刻フレーム」として追加・自動選択
  │    └─ 終了時間（参考情報）
  │
  └─ または直接画像をアップロード

Step2: AI解析中（ローディング表示）
  ├─ YouTube oEmbed で動画タイトルを取得
  ├─ 選択フレーム（または指定時刻フレーム）を /api/analyze に送信
  └─ プロンプトに以下を含める:
       ・【作品名】【シーン名】【ユーザー追加情報】（最優先）
       ・【動画タイトル】
       ・【解析フレーム時刻】（選択フレームの秒数）

Step3: 確認・修正
  ├─ 作品名・スポット名・エピソード・絵文字を確認・手動修正可能
  │    ※ユーザー入力値がAI結果より優先される
  ├─ 📍 場所候補（タップで選択）
  │    ├─ 確信度20%以上の候補を最大4件表示
  │    └─ タップ → geocode → fetchRealPhotos の順で自動実行
  ├─ 📸 現地写真候補
  │    ├─ geocode 成功後に /api/photos を呼び出し
  │    ├─ Wikipedia ja → en → Wikimedia Commons の順で最大12件取得
  │    ├─ シングルタップ: 写真を選択（シーン比較に反映）
  │    └─ ダブルタップ: ライトボックスで拡大表示
  ├─ 🎬 シーン比較カード（現地写真候補の下）
  │    ├─ 左: 解析したシーン（選択フレーム + 時刻バッジ）
  │    └─ 右: 現地写真（上で選択した写真が表示）
  ├─ 場所情報（住所入力 → /api/geocode → 地図プレビュー）
  └─ 議論URLの追加

Step4: 登録
  ├─ 仮登録（unconfirmed）：地図に薄いピンで表示
  ├─ 確定登録（confirmed）：通常ピンで表示
  ├─ user_id を付与して保存
  └─ 登録完了後「地図を見る」→ /?zLat=&zLng= でリダイレクト
       → index.html 側で flyTo アニメーション
```

---

## API 仕様

### `POST /api/analyze`

画像をGroq（LLaMA 4 Maverick）で解析し、聖地情報を返す。
Groq 失敗時は Gemini（gemini-2.0-flash）にフォールバック。

**リクエスト**
```json
{
  "url": "https://www.youtube.com/watch?v=...",
  "imageUrl": "https://i.ytimg.com/vi/.../maxresdefault.jpg",
  "imageBase64": "...",
  "imageMime": "image/jpeg",
  "prompt": "【作品名】薬屋のひとりごと\n【動画タイトル】...\nあなたはアニメ・マンガの聖地巡礼専門家です..."
}
```

**レスポンス**
```json
{
  "work": "薬屋のひとりごと",
  "title": "後宮の橋",
  "location": "京都府京都市右京区嵯峨野",
  "ep": "第3話",
  "confidence": 78,
  "emoji": "🌸",
  "candidates": [
    { "name": "渡月橋", "location": "京都府京都市右京区嵯峨天龍寺", "confidence": 78 },
    { "name": "宇治橋", "location": "京都府宇治市宇治", "confidence": 35 }
  ]
}
```

**使用モデル**
- Primary: `meta-llama/llama-4-maverick-17b-128e-instruct`（Groq）
- Fallback: `gemini-2.0-flash`（Gemini）

---

### `POST /api/frame`

YouTubeのStoryboard APIを利用して、動画の指定秒数のフレームを取得する。

**リクエスト**
```json
{ "videoId": "dQw4w9WgXcQ", "seconds": 90 }
```

**レスポンス（sharp利用可能時）**
```json
{ "imageBase64": "...", "mime": "image/jpeg", "w": 160, "h": 90 }
```

**レスポンス（sharpなし・フォールバック）**
```json
{
  "spriteUrl": "https://i.ytimg.com/sb/.../storyboard3_L2/M0.jpg",
  "crop": { "x": 320, "y": 90, "w": 160, "h": 90 }
}
```
フォールバック時はフロント側でcanvasを使ってcropする。

---

### `POST /api/photos`

指定座標の周辺写真をWikipedia / Wikimedia Commonsから取得する。

**リクエスト**
```json
{ "lat": 35.6844, "lng": 139.7195 }
```

**レスポンス**
```json
{
  "photos": [
    { "url": "https://upload.wikimedia.org/...", "title": "須賀神社" }
  ]
}
```

**取得ロジック（優先順位順）**
1. Wikipedia ja Geosearch（半径3km、最大10件）
2. Wikipedia en Geosearch（ja で3件未満の場合）
3. Wikimedia Commons Geosearch（まだ4件未満の場合）

---

### `POST /api/geocode`

住所テキストを緯度経度に変換する。

**リクエスト**
```json
{ "address": "東京都新宿区須賀町" }
```

**レスポンス（成功）**
```json
{ "lat": "35.6844", "lng": "139.7195" }
```

フォールバックとして Nominatim 直接呼び出しもフロント側で実装。

---

### `POST /api/scenes`（現在は未使用）

YouTube動画全体をGeminiで解析。現在は`/api/analyze`に統合されたため呼び出されていないが、将来的な再利用に備えて残存。

---

## エラーハンドリング

| エラー | 状況 | 対処 |
|--------|------|------|
| Groq 429（クォータ切れ） | 無料枠の1日上限超過 | Gemini にフォールバック |
| Gemini 429（クォータ切れ） | 無料枠の1日上限超過 | `quota_exceeded` を返す → UIでエラーカード表示 |
| frame API 失敗 | Storyboard取得不可 | フロントで最寄り静的フレームを使用 |
| photos API 0件 | 周辺にWikipedia記事なし | realPhotosCard を非表示 |
| geocode 失敗 | 住所不明・Nominatim 障害 | Nominatim に直接フォールバック → トースト通知 |

---

## 今後の実装計画

### Phase 1 — コアUX

- [x] **Supabase Auth ログイン**（Google OAuth）
- [ ] **「行った！」チェックイン機能**
  - スポットのポップアップに「行った！」ボタン
  - `checkins` テーブル（user_id, spot_id, visited_at）
  - チェックイン済みスポットのピン色変更
  - 訪問人数カウント表示
- [ ] **スポット詳細ページ**（独立ページ化・レビュー一覧）

### Phase 2 — コミュニティ

- [ ] **レビュー・コメント投稿**（`reviews` テーブル）
- [ ] **いいね・行きたい登録**（`likes` テーブル）
- [ ] **ユーザープロフィールページ**（巡礼済みスポット一覧・達成率）

### Phase 3 — 発見体験

- [ ] **作品別・地域別フィルター**
- [ ] **ランキング**（チェックイン数順、近くの聖地）
- [ ] **通知**（新スポット追加、コメント返信）

### 将来構想

- [ ] **AR構図ガイド**（カメラ越しにアニメシーンをオーバーレイ）
- [ ] **PWA化**（オフライン対応・プッシュ通知）
- [ ] **多言語対応**（英語・中国語・韓国語）
- [ ] **Web検索との連携**（Brave/Serper APIで聖地情報を補強）

---

## 開発ガイド

### 環境変数

| 変数名 | 説明 | 設定場所 |
|--------|------|----------|
| `GROQ_API_KEY` | Groq API キー | Vercel 環境変数 |
| `GEMINI_API_KEY` | Gemini API キー（フォールバック用） | Vercel 環境変数 |

### デプロイ

`main` ブランチへのプッシュで Vercel が自動デプロイ。

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
| Google Cloud Console | https://console.cloud.google.com |
