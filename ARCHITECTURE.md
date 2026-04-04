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
    ├── analyze.js      # Gemini API 呼び出し（Vercel Function）
    └── geocode.js      # 住所 → 座標変換（Vercel Function）
```

---

## システム構成図

```
ブラウザ (index.html / register.html)
    │
    ├─── Supabase REST API ──────────────── Supabase PostgreSQL
    │        spots テーブルの読み書き
    │
    ├─── /api/analyze ───────────────────── Gemini API (Google)
    │        YouTube URL / 画像 → AI解析       gemini-2.0-flash
    │        作品名・場所・エピソードを返す
    │
    ├─── /api/geocode ───────────────────── Nominatim (OpenStreetMap)
    │        住所テキスト → 緯度経度変換
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
- ステータスに応じたピン表示（透明度・ボーダー色）
- 作品タグに応じたピン色分け（kimi=赤、slam=緑、tenki=紫、other=橙）
- ヘッダー検索・スライドメニュー検索（作品名・場所名・スポット名）
- 左スライドメニュー（作品別アコーディオン一覧）
- スポットタップ → ポップアップ → 詳細パネル（PC: 下部バー / SP: ボトムシート）
- Google マップナビ起動
- モバイル用ドロワー（スポット一覧スワイプ）

### register.html（登録・編集画面）

**タブ構成**
- `新規登録` タブ：4ステップのウィザード形式
- `編集・修正` タブ：登録済みスポット一覧・編集・削除

**新規登録フロー（4ステップ）**

```
Step1: URL入力
  └─ YouTube / Instagram / X / TikTok の URL を貼り付け

Step2: AI解析中
  └─ /api/analyze に POST → Gemini がサムネイル画像＋URLを解析

Step3: 確認・修正
  ├─ 作品名・スポット名・エピソード・絵文字を確認・修正
  ├─ 場所候補を複数表示（タップで選択）
  ├─ 住所入力 → /api/geocode → 地図プレビュー
  └─ 議論URLの追加

Step4: 仮登録 / 確定登録
  ├─ 仮登録（unconfirmed）：地図に薄いピンで表示
  └─ 確定登録（confirmed）：通常ピンで表示
```

---

## API 仕様

### `POST /api/analyze`

YouTube動画などのURLとプロンプトを受け取り、Gemini APIに投げて聖地情報を返す。

**リクエスト**
```json
{
  "url": "https://www.youtube.com/watch?v=...",
  "imageUrl": "https://i.ytimg.com/vi/.../hqdefault.jpg",
  "prompt": "このアニメシーンの聖地（実在の場所）を特定してください。..."
}
```

**レスポンス**
```json
{
  "work": "君の名は。",
  "title": "須賀神社 階段",
  "location": "東京都新宿区須賀町",
  "ep": "エンディング",
  "confidence": 85,
  "candidates": [
    { "title": "須賀神社 階段", "location": "東京都新宿区須賀町", "lat": 35.684, "lng": 139.719 }
  ]
}
```

**使用モデル**: `gemini-2.0-flash`
（2.5-flash はレート制限が厳しいため 2.0-flash を使用）

---

### `POST /api/geocode`

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

## 既知の問題・対処済み事項

| 問題 | 状況 | 対処 |
|------|------|------|
| iPhone GitHub アプリで編集すると引用符・バッククォートが特殊文字に変換される | 解消 | Claude Code での開発に移行 |
| CSS変数が `var(–name)` のエンダッシュ（U+2013）になりスタイル崩れ | 修正済み | `var(--name)` に一括置換 |
| HTMLにMarkdownのコードフェンス（` ``` `）が混入 | 修正済み | 除去 |
| Gemini APIから `"null"` が返ると `result.work` でクラッシュ（500エラー） | 修正済み | nullチェックを追加 |
| `gemini-2.5-flash` でレート制限（429）エラー | 修正済み | `gemini-2.0-flash` に変更 |

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

### 注意事項

- iPhoneのGitHubアプリでのファイル編集は避ける（文字化けの原因）
- Claude Code での編集を推奨
- Supabase の anon key はクライアントに公開されているが、RLS で保護されている前提

---

## 外部サービス管理画面

| サービス | URL |
|----------|-----|
| Vercel | https://vercel.com/yanazoos-projects/anisha |
| Supabase | https://supabase.com/dashboard/project/zzpfnszijxkfxtietilr |
| GitHub | https://github.com/yanazoo/anisha |
