# アニしゃ / AniFrame 引き継ぎ資料

## プロジェクト概要

アニメ・マンガの聖地巡礼アプリ。
ユーザーがアニメシーンと同じ場所・構図で写真を撮れる体験を提供。

**キャッチコピー**: あのシーンを、あなたの手で。
**国内版**: アニしゃ / **海外版**: AniFrame

-----

## 本番URL

- アプリ: https://anisha-rho.vercel.app
- 登録ページ: https://anisha-rho.vercel.app/register.html
- GitHub: https://github.com/yanazoo/anisha

-----

## 技術スタック

|役割    |サービス                   |費用  |
|------|-----------------------|----|
|ホスティング|Vercel                 |無料枠 |
|DB    |Supabase PostgreSQL    |無料枠 |
|地図    |Leaflet + OpenStreetMap|完全無料|
|AI解析  |Gemini API (Google)    |無料枠 |
|座標変換  |Nominatim / Photon     |完全無料|
|フォント  |Yomogi (Google Fonts)  |無料  |

-----

## Supabase

- URL: https://zzpfnszijxkfxtietilr.supabase.co
- anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6cGZuc3ppanhrZnh0aWV0aWxyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwMTI2MzMsImV4cCI6MjA5MDU4ODYzM30.gqVLopJ3kveG1YwAcF6LQ7GFS2tZ0VRlHAG7M4je2Z0
- 管理画面: https://supabase.com/dashboard/project/zzpfnszijxkfxtietilr

## Vercel

- 管理画面: https://vercel.com/yanazoos-projects/anisha
- 環境変数: GEMINI_API_KEY（設定済み）

-----

## ファイル構成

```
anisha/
├ index.html        # メイン地図画面
├ register.html     # スポット登録・編集画面
└ api/
  ├ analyze.js      # Gemini API呼び出し（Vercel関数）
  └ geocode.js      # 住所→座標変換（Vercel関数）
```

-----

## DBテーブル（spots）

```sql
id            UUID (PK)
title         text        スポット名
work          text        作品名
tag           text        kimi/slam/tenki/other
emoji         text        絵文字
lat           float8      緯度
lng           float8      経度
location      text        住所
count         int         再現写真数
diff          text        難易度
ep            text        エピソード
status        text        unconfirmed/discussing/confirmed/official
confidence    int         確信度0-100
discussion_url text       議論URL（カンマ区切り複数可）
created_at    timestamp
```

### RLSポリシー

```sql
-- 読み取り・追加・更新・削除すべて公開
CREATE POLICY "Public read" ON spots FOR SELECT USING (true);
CREATE POLICY "Public insert" ON spots FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update" ON spots FOR UPDATE USING (true);
CREATE POLICY "Public delete" ON spots FOR DELETE USING (true);
```

-----

## api/analyze.js の状況

### 現状の問題

- iPhoneのGitHubアプリで編集すると引用符が特殊文字に変換される
- 現在は引用符・バッククォートをゼロにした特殊なコードで対応中
- Geminiモデルが`gemini-2.5-flash`で429エラー（レート制限）が発生

-----

## api/geocode.js の状況

- 住所→座標変換
- Nominatim（OSM）を使用
- iPhoneアップロードで同様の文字化け問題あり
- **要対応**: 正常に動作するか確認・必要なら書き直し

-----

## 現在の機能

### index.html（地図画面）

- Leaflet + OpenStreetMapで地図表示
- Supabaseからスポットデータ取得
- 作品別フィルター
- スポット検索
- 左スライドメニュー（作品別アコーディオン）
- スポットタップで詳細表示（ボトムシート）
- Googleマップでナビ起動
- スプラッシュ画面（1.5秒）
- フォント: Yomogi全体適用
- ピンのステータス色分け（未実装→要対応）

### register.html（登録・編集画面）

- タブ切り替え（新規登録 / 編集・修正）
- YouTubeのURLからサムネイル取得→Gemini解析
- AI解析結果の確認・修正UI
- 各フィールドに「AI」「編集済」タグ表示
- 場所候補の複数表示・タップ選択
- 議論URL追加機能
- 仮登録（unconfirmed）/ 確定登録（confirmed）の2択
- 登録済みスポット一覧・編集・削除
- ステータスフロー表示

-----

## 今後の実装予定

- [ ] geocode.jsの修正・動作確認
- [ ] 地図画面のピンステータス色分け（unconfirmed=薄い、confirmed=濃い）
- [ ] マイページ機能（訪問スタンプ・アルバム）
- [ ] シェア機能（SNS投稿・ルートシェア）
- [ ] ユーザー認証（Supabase Auth）
- [ ] AR構図ガイド
- [ ] 多言語対応（英語・中国語・韓国語）
- [ ] PWA化

-----

## ステータス設計

|ステータス      |意味      |ピン色|
|-----------|--------|---|
|unconfirmed|仮登録・未確認 |薄い赤|
|discussing |X等で議論中  |黄色 |
|confirmed  |コミュニティ確定|緑  |
|official   |公式認定    |金  |

-----

## 備考

- iPhoneのモバイルアプリでGitHub編集すると引用符が変換される問題あり
- Claude Codeでの開発に切り替えることでこの問題が解消される
- Gemini APIの無料枠は変更リスクあり→将来的にClaude/HuggingFaceへの切り替えを想定
- api/analyze.jsはAIプロバイダーを切り替えられる設計にしてある（AI_PROVIDER変数）