# 人狼BOYZ (jinro-boyz_next) 開発ロードマップ

jinro_rails（レガシーRailsアプリ）の全機能をNext.jsフルスタックアプリに移行・再実装する。

---

## Phase 0: プロジェクト基盤構築 ✅ 完了

Next.jsプロジェクトの初期セットアップとインフラ整備。

- Next.js 16 (App Router) プロジェクト作成
- TailwindCSS 4 + shadcn/ui 初期化
- Prisma 6 スキーマ定義（全10モデル、Railsから移植・統合）
- tRPC v11 基盤（ルーター、API route、React Query provider）
- Supabase Auth 基盤（client / server / middleware）
- Zustand ストア（ui-store, game-store）
- Zod バリデータ（auth, village）
- ゲームコアロジック骨格（roles, assign-roles, lynch, attack, judge）
- 全ページルート スケルトン
- CI / Vercel 設定

---

## Phase 1: 認証 + ユーザー管理 ✅ 完了

Supabase Auth統合、ログイン/サインアップUI、プロフィールCRUD。

- Server Actions で signup / login / logout
- ログインフォーム（React Hook Form + Zod + shadcn/ui）
- サインアップフォーム（username, email, password, confirmPassword）
- tRPC user ルーター（me, updateProfile）
- メインレイアウト改善（ユーザー名表示、ログアウトボタン、未認証時ログインリンク）
- プロフィールページ（ユーザー情報表示 + コメント編集）
- `/villages` を公開ルートに設定

詳細: [phase1-plan.md](./phase1-plan.md)

---

## Phase 2: 村一覧 + 村作成

村の閲覧・作成・参加・退出。ゲーム開始前の準備フェーズ。

### 機能
- **村一覧ページ** (`/villages`)
  - 進行中 / 募集中 / 終了済み のフィルタリング
  - ページネーション
  - 村ステータス、参加人数、作成者の表示
- **村作成ダイアログ**
  - 村名、プレイヤー数（5〜16）、議論時間、アクセスパスワード（任意）、投票先表示設定
  - tRPC `village.create` で保存
- **村詳細ページ** (`/villages/[villageId]`)
  - 村情報の表示
  - 参加プレイヤー一覧
  - 参加 / 退出ボタン
  - アクセスパスワード入力（設定されている場合）
  - 村主によるゲーム開始ボタン（人数が揃った時）
  - 村主による廃村ボタン
  - 村主によるプレイヤーキック機能

### tRPC ルーター拡張
- `village.list` — フィルタリング + ページネーション対応
- `village.byId` — 詳細取得（プレイヤー一覧含む）
- `village.join` — 村に参加
- `village.leave` — 村から退出
- `village.start` — ゲーム開始（ロール割り当て + Room作成）
- `village.ruin` — 廃村
- `village.kick` — プレイヤーキック

---

## Phase 3: ゲーム画面 + ゲーム進行

リアルタイムチャットとゲーム進行ロジック。人狼ゲームの核心部分。

### 機能
- **ゲームルーム** (`/villages/[villageId]/game`)
  - チャットエリア（メインルーム / 人狼ルーム / 死者ルーム の切り替え）
  - メッセージ送信（リアルタイム）
  - システムメッセージ表示（ゲーム進行の通知）
  - プレイヤー一覧（生存 / 死亡 状態表示）
  - 残り時間カウントダウン
- **アクションエリア**（役職に応じた操作UI）
  - 投票（昼：全プレイヤー）
  - 襲撃先選択（夜：人狼のみ）
  - 占い対象選択（夜：占い師のみ）
  - 護衛対象選択（夜：騎士のみ）
- **ゲーム進行ロジック**
  - 昼フェーズ: 議論 → 投票 → 処刑
  - 夜フェーズ: 人狼襲撃 + 占い + 護衛 → 結果判定
  - 勝利判定（人狼全滅 → 人間勝利 / 人狼≧人間 → 人狼勝利）
  - エピローグ: 全ロール開示
- **自動進行** (`/api/cron/proceed-villages`)
  - Vercel Cron で定期実行
  - `discussion_time` 経過後に自動でフェーズ切り替え

### リアルタイム通信
- Supabase Realtime（Postgres Changes or Broadcast）でメッセージ配信
- ページリロード指示（ゲーム状態変更時）

### tRPC ルーター
- `room.posts` — メッセージ取得
- `room.send` — メッセージ送信
- `record.vote` — 投票
- `record.attack` — 襲撃
- `record.divine` — 占い
- `record.guard` — 護衛
- `village.remainingTime` — 残り時間取得
- `village.divineResult` — 占い結果取得
- `village.voteResult` — 霊媒結果取得

---

## Phase 4: ゲーム結果 + 戦績

ゲーム終了後の結果表示とユーザー戦績。

### 機能
- **ゲーム結果画面**
  - 勝利陣営の表示
  - 全プレイヤーの役職開示
  - 日ごとの投票・襲撃・占い・護衛の結果一覧
- **プロフィール戦績** (`/profile`)
  - 参加ゲーム数（役職別）
  - 勝利数（役職別）
  - 勝率

### tRPC ルーター
- `user.stats` — ユーザーの戦績統計

---

## Phase 5: UI/UX 改善 + 追加機能

ユーザー体験の向上と細かな機能追加。

### 機能
- **アバター機能**
  - ユーザーアバター（プロフィール画像）
  - ゲーム内プレイヤーアバター
  - Supabase Storage で画像アップロード
- **通知機能**
  - システムお知らせ（管理者が作成）
  - お知らせ一覧ページ
- **ゲームマニュアル**
  - ルール説明ページ
  - 役職解説
- **管理者機能**
  - ユーザー管理（ブラックリスト）
  - 通知・マニュアルのCRUD
- **レスポンシブ対応**
  - モバイル最適化
- **ダークモード**
  - next-themes（既にインストール済み）

---

## Phase 6: 本番デプロイ + 運用

本番環境への公開と運用基盤。

### 機能
- Vercel デプロイ設定
- Supabase 本番プロジェクト設定
- 環境変数管理
- Sentry エラー監視（依存関係は設定済み）
- SEO（meta タグ、OGP）
- パフォーマンス最適化
- Vercel Cron 本番設定

---

## リファレンス: jinro_rails からの機能移行マップ

| jinro_rails 機能 | Phase | jinro-boyz_next 対応 |
|-----------------|-------|---------------------|
| Devise (認証) | 1 | Supabase Auth + Server Actions |
| ユーザープロフィール | 1 | tRPC user ルーター + Server Component |
| 村一覧 (VillagesController#index) | 2 | tRPC village.list + React |
| 村作成 (VillagesController#create) | 2 | tRPC village.create + Dialog |
| 村参加/退出 (PlayersController) | 2 | tRPC village.join/leave |
| ゲーム開始 (VillagesController#start) | 2 | tRPC village.start |
| 廃村 (VillagesController#ruin) | 2 | tRPC village.ruin |
| キック (KicksController) | 2 | tRPC village.kick |
| チャット (RoomsController + ActionCable) | 3 | Supabase Realtime + tRPC |
| 投票/襲撃/占い/護衛 (RecordsController) | 3 | tRPC record ルーター |
| ゲーム自動進行 (ProceedVillageJob) | 3 | Vercel Cron + API route |
| ゲーム結果 | 4 | Server Component |
| ユーザー戦績 | 4 | tRPC user.stats |
| アバター (ActiveStorage) | 5 | Supabase Storage |
| 通知 (NotificationsController) | 5 | tRPC + admin UI |
| マニュアル (ManualsController) | 5 | 静的ページ or CMS |
| Sidekiq ダッシュボード | 6 | Vercel Cron 監視 |
| Twitter連携 (TweetVillageJob) | - | 優先度低、必要に応じて |
