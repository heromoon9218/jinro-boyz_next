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

## Phase 2: 村一覧 + 村作成 ✅ 完了

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

## Phase 3: ゲーム画面 + ゲーム進行 🔄 PR #15 レビュー中

リアルタイムチャットとゲーム進行ロジック。人狼ゲームの核心部分。

### 機能
- **ゲームルーム** (`/villages/[villageId]/game`)
  - チャットエリア（MAIN / WOLF / DEAD タブ切り替え、無限スクロール）
  - メッセージ送信（リアルタイム、Zod バリデーション付き）
  - システムメッセージ表示（投票結果、襲撃結果、生存者一覧、ゲーム終了＆役職公開）
  - プレイヤーパネル（生存/死亡表示、役職バッジ、クリックで対象選択）
  - カウントダウンタイマー
- **アクションパネル**（役職に応じた操作UI）
  - 投票（昼：全プレイヤー）
  - 襲撃先選択（夜：人狼のみ）
  - 占い対象選択（夜：占い師のみ）＋ 占い結果表示
  - 護衛対象選択（夜：騎士のみ）
  - 霊媒結果表示（霊媒師のみ）
- **ゲーム進行ロジック** (`proceedDay` トランザクション)
  - 昼フェーズ: 議論 → 投票 → 処刑（同数時ランダム）
  - 夜フェーズ: 占い → 護衛 → 襲撃 → 結果判定
  - 処刑済みプレイヤーの夜アクション無効化
  - 勝利判定（人狼全滅 → 人間勝利 / 人狼≧人間 → 人狼勝利）
  - Day 1 は襲撃スキップ
- **ゲーム結果画面**
  - 勝利陣営の表示
  - 全プレイヤーの役職開示
  - 日ごとの投票・襲撃結果一覧
- **自動進行** (`/api/cron/proceed-villages`)
  - Vercel Cron で定期実行
  - クライアント補助トリガー（`triggerProceed`、インメモリ5秒クールダウン）
  - `discussion_time` 経過後に自動でフェーズ切り替え

### リアルタイム通信
- Supabase Realtime Postgres Changes で `posts` テーブル監視（チャット即時反映）
- Supabase Realtime Broadcast（REST `httpSend`）でゲーム状態変更通知
- `useRealtimePosts` / `useGameRealtime` カスタムフック

### tRPC ルーター (`game`)
- `game.state` — ゲーム状態取得（プレイヤー、役職、占い結果、霊媒結果等）
- `game.messages` — チャット取得（ルーム別、ページネーション、アクセス制御付き）
- `game.results` — ゲーム結果取得
- `game.vote` — 投票
- `game.attack` — 襲撃
- `game.divine` — 占い
- `game.guard` — 護衛
- `game.sendMessage` — メッセージ送信
- `game.triggerProceed` — 日進行トリガー

---

## Phase 4: 戦績 + ゲーム終了後の閲覧

ユーザー戦績とゲーム終了後のルーム公開。

> **Note**: ゲーム結果画面（勝利陣営表示、役職開示、日別記録）は Phase 3 で実装済み。

### 機能
- **プロフィール戦績** (`/profile`)
  - 参加ゲーム数（役職別）
  - 勝利数（役職別）
  - 勝率
- **終了済み村の閲覧**
  - WOLF / DEAD ルームの全公開（Phase 3 でアクセス制御は実装済み）
  - 村一覧での終了済み村の結果サマリー表示

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
| チャット (RoomsController + ActionCable) | 3 | Supabase Realtime + tRPC game ルーター |
| 投票/襲撃/占い/護衛 (RecordsController) | 3 | tRPC game ルーター (vote/attack/divine/guard) |
| ゲーム自動進行 (ProceedVillageJob) | 3 | Vercel Cron + triggerProceed + API route |
| ゲーム結果 | 3 | GameResult コンポーネント (game.results) |
| ユーザー戦績 | 4 | tRPC user.stats |
| アバター (ActiveStorage) | 5 | Supabase Storage |
| 通知 (NotificationsController) | 5 | tRPC + admin UI |
| マニュアル (ManualsController) | 5 | 静的ページ or CMS |
| Sidekiq ダッシュボード | 6 | Vercel Cron 監視 |
| Twitter連携 (TweetVillageJob) | - | 優先度低、必要に応じて |
