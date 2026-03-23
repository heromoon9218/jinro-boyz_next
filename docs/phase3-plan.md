# Phase 3: ゲーム画面 + ゲーム進行 実装プラン

**ステータス**: PR #15 レビュー中
**ブランチ**: `feat/phase3-gameplay`
**PR**: #15

## Context

Phase 2で村管理（一覧・作成・参加・開始）が完成済み。
Phase 3では**リアルタイムチャット、役職アクション、日進行ロジック、ゲーム結果画面**を実装し、人狼ゲームとして遊べる状態にする。

---

## 実装済み機能

### ゲーム画面 (`/villages/[villageId]/game`)

- **GameClient** — ゲーム状態に応じてプレイ画面 or 結果画面を切替
- **GameHeader** — 村名 / Day表示 / カウントダウンタイマー
- **PlayerPanel** — 生存/死亡表示、役職バッジ（自分/ゲーム終了時）、クリックで対象選択
- **ChatArea** — MAIN/WOLF/DEADタブ切替、無限スクロール、リアルタイム更新
- **ChatMessage** — メッセージ表示（システムメッセージ対応）
- **ActionPanel** — 役職に応じた投票/襲撃/占い/守護ボタン、占い＆霊媒結果表示
- **CountdownTimer** — 残り時間カウントダウン、0到達で triggerProceed 発火
- **GameResult** — 勝利陣営表示、全プレイヤー役職公開、日ごとの記録一覧

### バックエンド (`game` tRPC ルーター)

| エンドポイント | 種別 | 説明 |
|---------------|------|------|
| `game.state` | query | ゲーム状態取得（プレイヤー、占い結果、霊媒結果等） |
| `game.messages` | query | ルーム別チャット取得（ページネーション、アクセス制御付き） |
| `game.results` | query | ゲーム結果（勝者、役職一覧、日別記録） |
| `game.vote` | mutation | 投票（昼フェーズ） |
| `game.attack` | mutation | 襲撃先選択（人狼のみ） |
| `game.divine` | mutation | 占い対象選択（占い師のみ） |
| `game.guard` | mutation | 護衛対象選択（騎士のみ） |
| `game.sendMessage` | mutation | メッセージ送信（ルーム別書き込み権限チェック） |
| `game.triggerProceed` | mutation | 日進行トリガー（5秒インメモリクールダウン） |

### ゲーム進行ロジック (`proceedDay`)

トランザクション内で一括実行:
1. 投票集計 → 処刑（同数時ランダム、投票なし時は生存者全員からランダム）
2. 処刑結果のシステムメッセージ生成
3. 勝敗判定（処刑後）
4. 夜アクション実行（占い → 護衛 → 襲撃）※処刑済みプレイヤーの行動は無効
5. 襲撃結果判定（護衛成功時は襲撃無効、処刑済み対象への襲撃も無効）
6. 勝敗判定（襲撃後）
7. 次の日へ進行 or ゲーム終了
8. システムメッセージ生成（夜の結果、朝の生存者一覧、ゲーム終了時の役職公開）
9. 変更があった場合のみ Realtime Broadcast で通知

### 日進行トリガー

- **Vercel Cron** (`/api/cron/proceed-villages`): IN_PLAY かつ nextUpdateTime 超過の村に順次 proceedDay 実行
- **クライアント補助**: カウントダウン0到達時に `game.triggerProceed` を呼び出し（Cron の遅延を補完）
- **重複防止**: インメモリレート制限（同一村5秒クールダウン）

### Realtime 統合

- **Postgres Changes**: `posts` テーブルの INSERT を監視 → チャット即時反映（`useRealtimePosts`）
- **Broadcast**: `game_updated` イベントで日進行通知 → クライアントが state を再取得（`useGameRealtime`）
- サーバー側は REST `httpSend` で Broadcast（WebSocket subscribe 不要）

### Room アクセス制御

| Room | ゲーム中（読み取り） | ゲーム中（書き込み） | ゲーム終了後 |
|------|---------------------|---------------------|-------------|
| MAIN | 誰でも（`publicProcedure`） | 生存者のみ | 誰でも閲覧可 |
| WOLF | 人狼のみ | 生存中の人狼のみ | 誰でも閲覧可 |
| DEAD | 死亡者のみ | 死亡者のみ | 誰でも閲覧可 |

### Supabase 手動設定（必須）

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE posts;
```

---

## テストカバレッジ

### ユニットテスト (`vitest`)

- **proceedDay**: 正常系（投票→処刑→夜アクション→日進行）、Day 1 襲撃スキップ、処刑済みプレイヤーの夜アクション無効化、勝敗判定、処刑済み対象への襲撃無効化、broadcastは実更新時のみ
- **game ルーター**: アクション mutation の正常系・異常系（13件）、messages 閲覧アクセス制御、sendMessage 書き込みアクセス制御（8件）
- **ChatArea**: 無限スクロール、スクロール位置保持
- **CountdownTimer**: カウントダウン表示、0到達イベント

---

## 修正済みバグ (PR #15 内)

| コミット | 内容 |
|---------|------|
| `58c6e0d` | 夜フェーズで処刑済みプレイヤーの行動を除外 |
| `c432f30` | 日替わり後もチャット結果を表示（部屋単位の単一タイムラインに変更） |
| `799936d` | カウントダウン終了時の進行重複を防止 |
| `41145fe` | GameResult の区切り線判定を修正（配列位置ベース） |
| `1816997` | 終了済み村の勝敗不整合を検知（winner null チェック） |
| `b96bb04` | game.messages の破壊的 reverse を toReversed() に修正 |
| `a3877f4` | Realtime broadcast を httpSend に変更（WebSocket subscribe 不要に） |
| `1581eaa` | divineResults を Result.divinedPlayerId に合わせる |
| `023e56f` | proceedDay で実更新時のみ broadcastGameUpdate |
| `066effb` | PR レビュー指摘6件修正（ランダム処刑、レート制限、Realtime cleanup 等） |
| `026ddd5` | 処刑済みプレイヤーへの襲撃を無効化 |
| `cdb2afb` | action mutations と room access control のテスト追加 |

---

## 主要ファイル

| ファイル | 役割 |
|---------|------|
| `src/server/trpc/routers/game.ts` | game tRPC ルーター（state/messages/results/actions） |
| `src/server/game/proceed-day.ts` | 日進行ロジック（proceedDay） |
| `src/server/game/messages.ts` | システムメッセージ生成 |
| `src/server/game/broadcast.ts` | Realtime broadcast ユーティリティ |
| `src/server/game/lynch.ts` | 処刑ロジック（同数ランダム対応） |
| `src/app/.../game/_components/game-client.tsx` | ゲーム画面メインコンポーネント |
| `src/app/.../game/_components/chat-area.tsx` | チャットエリア（タブ切替、無限スクロール） |
| `src/app/.../game/_components/action-panel.tsx` | アクションパネル（役職別操作UI） |
| `src/app/.../game/_components/game-result.tsx` | ゲーム結果画面 |
| `src/lib/supabase/realtime.ts` | Supabase Realtime ユーティリティ |
| `src/lib/hooks/use-realtime-posts.ts` | チャットリアルタイム更新フック |
| `src/lib/hooks/use-game-realtime.ts` | ゲーム状態リアルタイム更新フック |
| `src/lib/validators/game.ts` | Zod バリデーションスキーマ |
| `src/app/api/cron/proceed-villages/route.ts` | Cron route |

---

## 残作業

- [ ] Cursor Bugbot 指摘の2件を確認・対応
- [ ] PR #15 マージ
