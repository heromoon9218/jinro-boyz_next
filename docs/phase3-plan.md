# Phase 3: ゲーム画面 + ゲーム進行 実装プラン

**ステータス**: 実装中

## Context

Phase 2で村管理機能（一覧・作成・参加/退出・開始/廃村/キック）が完成済み。
Phase 3では**ゲーム画面UI、チャット、夜間アクション、日次進行ロジック、Cron自動進行**を実装し、人狼ゲームとしてプレイ可能な状態にする。

---

## Step 1: ゲームロジック修正（純粋関数）

### lynch.ts 修正

CLAUDE.md のルールに従い、既存ロジックを修正:

- **投票同数**: ランダムで1人を処刑（現在は null を返している → ランダム選択に変更）
- **投票なし**: 生存者全員からランダムで1人を処刑

```
determineLynchTarget(votes, alivePlayers) → string
```

### proceed-day.ts 実装

ゲーム進行のコアロジック。Prisma トランザクション内で実行:

1. 村を FOR UPDATE でロック
2. **投票解決** → 処刑（Record の voteTargetId を集計）
3. **終了判定** (judgeEnd)
4. **夜間解決**:
   - 処刑されたプレイヤーの夜アクションは無効
   - 襲撃: 人狼の attackTargetId → 騎士の guardTargetId と照合 → resolveAttack
   - 襲撃対象未設定時: 生存人間からランダム選択
   - 占い: divineTargetId を Result に記録
   - 護衛: guardTargetId を Result に記録
5. **終了判定** (再度)
6. Result レコード作成（当日の結果）
7. Day +1、nextUpdateTime 更新
8. 次日の Record を生存者分作成
9. システムメッセージ投稿（投票結果・朝メッセージ等）

### system-messages.ts 新規作成

システムメッセージ生成ヘルパー:
- `voteResultMessage(votes, executed, showVoteTarget)` — 投票結果
- `morningMessage(day, killedPlayer)` — 朝のメッセージ（犠牲者 or 平和）
- `gameEndMessage(winner)` — ゲーム終了メッセージ

---

## Step 2: Zod バリデーション追加

**修正ファイル: `src/lib/validators/game.ts` (新規)**

- `voteSchema` — { villageId, targetPlayerId }
- `attackSchema` — { villageId, targetPlayerId }
- `divineSchema` — { villageId, targetPlayerId }
- `guardSchema` — { villageId, targetPlayerId }
- `sendMessageSchema` — { roomId, content(1-500文字) }
- `gameStateSchema` — { villageId }
- `postsSchema` — { roomId, day? }

---

## Step 3: game tRPC ルーター

**新規ファイル: `src/server/trpc/routers/game.ts`**

| Procedure | 種類 | 機能 |
|-----------|------|------|
| `game.state` | protected query | ゲーム状態取得（村情報・プレイヤー・ルーム・当日Record） |
| `game.vote` | protected mutation | 投票先設定（生存者のみ） |
| `game.attack` | protected mutation | 襲撃先設定（生存中の人狼のみ） |
| `game.divine` | protected mutation | 占い先設定（生存中の占い師のみ） |
| `game.guard` | protected mutation | 護衛先設定（生存中の騎士のみ） |
| `game.divineResults` | protected query | 占い結果取得（占い師のみ） |
| `game.psychicResults` | protected query | 霊媒結果取得（霊媒師のみ） |
| `game.posts` | public query | ルーム別メッセージ取得（アクセス権チェック付き） |
| `game.sendMessage` | protected mutation | メッセージ送信（Room Access Control準拠） |

### アクセス制御（Room Access Control）

| Room | ゲーム中（読み取り） | ゲーム中（書き込み） | ゲーム終了後 |
|------|---------------------|---------------------|-------------|
| MAIN | 誰でも（未ログイン含む） | 生存者のみ | 誰でも閲覧可 |
| WOLF | 人狼のみ | 生存中の人狼のみ | 誰でも閲覧可 |
| DEAD | 死亡者のみ | 死亡者のみ | 誰でも閲覧可 |

---

## Step 4: Cron ルート完成

**修正ファイル: `src/app/api/cron/proceed-villages/route.ts`**

- `nextUpdateTime <= now` かつ `status = IN_PLAY` の村を取得
- 各村に `proceedDay()` を実行
- エラーハンドリング（1村の失敗が他に影響しないよう）

---

## Step 5: Zustand ストア更新

**修正ファイル: `src/stores/game-store.ts`**

- `currentRoom: RoomType` — 表示中のルーム
- `showSkillPanel: boolean` — スキルパネル表示切替（モバイル用）
- サーバー由来の状態（day, isNight等）は削除し、tRPC query に委譲

---

## Step 6: Supabase Realtime フック

**新規ファイル: `src/lib/hooks/use-realtime-posts.ts`**

- Supabase Realtime で posts テーブルの INSERT を購読
- roomId でフィルタリング
- 新メッセージ受信時に React Query キャッシュに追加

**新規ファイル: `src/lib/hooks/use-realtime-village.ts`**

- villages テーブルの UPDATE を購読（day変更、status変更の検知）
- 変更検知時に game.state クエリを invalidate

---

## Step 7: ゲーム画面 UI

### コンポーネント構成

```
game/page.tsx (server component)
└── GameClient (client component, メインコンテナ)
    ├── GameHeader
    │   ├── 村名 + Day表示
    │   └── Timer（残り時間カウントダウン）
    ├── RoomTabs (MAIN / WOLF / DEAD、ロール・ステータスに応じて表示)
    ├── ChatArea
    │   ├── MessageList (スクロール可、自動スクロール)
    │   │   └── MessageItem (プレイヤーメッセージ / システムメッセージ)
    │   └── ChatInput (発言権チェック付き)
    ├── SkillPanel (チャットと切替表示)
    │   ├── VoteSection (全生存者用)
    │   ├── AttackSection (人狼のみ)
    │   ├── DivineSection (占い師のみ、結果表示付き)
    │   ├── PsychicSection (霊媒師のみ、結果表示付き)
    │   └── GuardSection (騎士のみ)
    └── PlayerList (生存/死亡バッジ、終了後ロール公開)
```

### 新規ファイル一覧

| ファイル | 役割 |
|---------|------|
| `src/app/(main)/villages/[villageId]/game/page.tsx` | サーバーコンポーネント（修正） |
| `src/app/(main)/villages/[villageId]/game/_components/game-client.tsx` | メインクライアントコンテナ |
| `src/app/(main)/villages/[villageId]/game/_components/game-header.tsx` | ヘッダー（村名・Day・タイマー） |
| `src/app/(main)/villages/[villageId]/game/_components/room-tabs.tsx` | ルーム切替タブ |
| `src/app/(main)/villages/[villageId]/game/_components/chat-area.tsx` | チャットエリア |
| `src/app/(main)/villages/[villageId]/game/_components/message-item.tsx` | メッセージ表示 |
| `src/app/(main)/villages/[villageId]/game/_components/chat-input.tsx` | チャット入力 |
| `src/app/(main)/villages/[villageId]/game/_components/skill-panel.tsx` | スキルパネル |
| `src/app/(main)/villages/[villageId]/game/_components/player-list-panel.tsx` | プレイヤー一覧 |
| `src/app/(main)/villages/[villageId]/game/_components/timer.tsx` | タイマー |

---

## Step 8: village.start 連携修正

**修正ファイル: `src/server/trpc/routers/village.ts`**

- ゲーム開始時にシステムメッセージ（開始メッセージ）を MAIN ルームに投稿
- ゲーム開始後 `/villages/[id]/game` へのリダイレクトをフロントで実行

**修正ファイル: 村詳細 UI**

- status が `IN_PLAY` の場合、「ゲーム画面へ」ボタンを表示

---

## 修正対象ファイル一覧

| ファイル | 操作 |
|---------|------|
| `src/server/game/lynch.ts` | 修正（同票ランダム対応） |
| `src/server/game/proceed-day.ts` | 修正（完全実装） |
| `src/server/game/system-messages.ts` | **新規** |
| `src/lib/validators/game.ts` | **新規** |
| `src/server/trpc/routers/game.ts` | **新規** |
| `src/server/trpc/routers/_app.ts` | 修正（game ルーター追加） |
| `src/server/trpc/routers/village.ts` | 修正（開始時システムメッセージ） |
| `src/app/api/cron/proceed-villages/route.ts` | 修正（完全実装） |
| `src/stores/game-store.ts` | 修正 |
| `src/lib/hooks/use-realtime-posts.ts` | **新規** |
| `src/lib/hooks/use-realtime-village.ts` | **新規** |
| `src/app/(main)/villages/[villageId]/game/page.tsx` | 修正 |
| `src/app/(main)/villages/[villageId]/game/_components/*.tsx` | **新規** (10ファイル) |
| `src/app/(main)/villages/[villageId]/_components/village-actions.tsx` | 修正 |

---

## 検証方法

1. `npm run lint` — エラーなし
2. `npm run build` — ビルド成功
3. ブラウザ手動テスト:
   - ゲーム開始 → ゲーム画面にリダイレクト
   - MAINルームでチャット送受信
   - 人狼ルームが人狼にのみ表示
   - 死亡後に霊界ルーム表示
   - 投票先設定 → 設定内容が反映
   - 人狼の襲撃先設定
   - 占い師の占い先設定 → 結果確認
   - 霊媒師の結果確認
   - 騎士の護衛先設定
   - タイマー表示・カウントダウン
   - Cron 実行 → 日次進行
   - 終了判定 → 勝利表示・ロール公開
   - ゲーム終了後に全ルーム閲覧可
