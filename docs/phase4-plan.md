# Phase 4: ゲーム結果 + 戦績 実装プラン

**ステータス**: 未着手

## Context

Phase 3でゲーム画面UI、チャット、夜間アクション、日次進行ロジックが完成済み。
Phase 4では**ゲーム結果の構造化表示**と**ユーザー戦績**を実装する。

### Phase 3で実装済みの関連機能

| 機能 | 状態 |
|------|------|
| Result モデル（Prisma） | day, votedPlayerId, attackedPlayerId, divinedPlayerId, guardedPlayerId |
| Result レコード作成 | proceed-day.ts で日ごとに自動作成済み |
| エピローグ表示 | GameHeader に「エピローグ」バッジ + 勝者バッジ |
| ロール開示 | PlayerListPanel でゲーム終了時に全役職を表示 |
| システムメッセージ | gameEndMessage で配役一覧を MAIN ルームに投稿 |
| divineResults / psychicResults | 役職限定の結果閲覧プロシージャ |

### Phase 4で新規実装する機能

1. **ゲーム結果パネル** — 日ごとの処刑・襲撃・占い・護衛の構造化された結果一覧
2. **プロフィール戦績** — 役職別の参加数・勝利数・勝率テーブル

---

## Step 1: `game.results` tRPC プロシージャ

**修正ファイル: `src/server/trpc/routers/game.ts`**

ゲーム終了後に、日ごとの結果と投票詳細をまとめて返す public クエリ。

```typescript
game.results: publicProcedure
  .input(gameStateSchema)  // { villageId }
  .query(...)
```

### レスポンス構造

```typescript
{
  results: {
    day: number;
    votedPlayer: { username: string; role: Role } | null;     // 処刑
    attackedPlayer: { username: string; role: Role } | null;   // 襲撃犠牲者
    divinedPlayer: { username: string; role: Role } | null;    // 占い対象
    guardedPlayer: { username: string } | null;                // 護衛対象
  }[];
  voteDetails: {
    day: number;
    voterName: string;
    targetName: string | null;  // null = 投票なし
  }[];
  showVoteTarget: boolean;  // 投票先表示設定
}
```

### アクセス制御

- `publicProcedure`（未ログインでも閲覧可）
- 村 status が `ENDED` または `RUINED` の場合のみデータを返す
- それ以外は `BAD_REQUEST` エラー

### 実装メモ

- Result テーブルを `villageId` + `orderBy: day asc` で取得
- `include` で votedPlayer, attackedPlayer, divinedPlayer, guardedPlayer の username/role を取得
- Record テーブルから投票詳細（voteTargetId + player 名）を取得
- divinedPlayer には role を含める（人狼判定の表示に必要）
- guardedPlayer には role を含めない（護衛対象の役職は不要）

---

## Step 2: 結果パネル コンポーネント

ゲーム終了後に「結果」タブを追加し、構造化された結果一覧を表示。

### UI 設計

```
GameClient (既存修正)
├── RoomTabs (修正: ゲーム終了時に「結果」タブ追加)
├── ChatArea (既存: ルームタブ選択時)
├── ResultsPanel (新規: 「結果」タブ選択時)
│   └── 日ごとの結果カード
│       ├── 昼: 処刑結果 + 投票内訳
│       └── 夜: 襲撃結果 + 占い/護衛情報
└── PlayerListPanel (既存)
```

### 表示内容（日ごと）

| セクション | 表示内容 |
|-----------|---------|
| 処刑 | 処刑対象プレイヤー名 + 役職 |
| 投票内訳 | showVoteTarget=true: 誰→誰 / false: 得票数のみ |
| 襲撃 | 犠牲者名 + 役職 / 犠牲者なし（護衛成功 or 襲撃失敗） |
| 占い | 占い対象 + 人狼/人狼ではない |
| 護衛 | 護衛対象名 |

### ファイル

| ファイル | 操作 |
|---------|------|
| `src/app/(main)/villages/[villageId]/game/_components/results-panel.tsx` | **新規** |
| `src/app/(main)/villages/[villageId]/game/_components/game-client.tsx` | 修正（結果タブ時に ResultsPanel 表示） |
| `src/app/(main)/villages/[villageId]/game/_components/room-tabs.tsx` | 修正（ゲーム終了時に「結果」タブ追加） |
| `src/stores/game-store.ts` | 修正（`showResultsPanel: boolean` 追加） |

### game-store 修正方針

`RoomType` に "RESULTS" を混ぜず、独立した `showResultsPanel` フラグを追加:

```typescript
interface GameState {
  currentRoom: RoomType;
  showSkillPanel: boolean;
  showResultsPanel: boolean;  // 追加
  // ...
}
```

- 「結果」タブクリック → `showResultsPanel: true`
- ルームタブクリック → `showResultsPanel: false`

---

## Step 3: `user.stats` tRPC プロシージャ

**修正ファイル: `src/server/trpc/routers/user.ts`**

ログインユーザーの戦績統計を集計して返す。

```typescript
user.stats: protectedProcedure.query(...)
```

### レスポンス構造

```typescript
{
  roleStats: {
    role: Role;          // VILLAGER, WEREWOLF, ...
    played: number;      // 対戦数
    won: number;         // 勝利数
  }[];
  totalPlayed: number;   // 合計対戦数
  totalWon: number;      // 合計勝利数
}
```

### 集計ロジック

1. Player テーブルから当該ユーザーの全参加記録を取得（`village.status === "ENDED"` のみ）
2. 各 Player の `role` と `village.winner` から勝敗判定:
   - `ROLE_TEAMS[role] === "HUMAN"` → `winner === "HUMANS"` で勝利
   - `ROLE_TEAMS[role] === "WEREWOLF"` → `winner === "WEREWOLVES"` で勝利
3. 役職別 + 合計を集計

### Rails リファレンス

```ruby
# Rails版: User#winned_village_count
def winned_village_count(role: nil)
  if role.in?(Player.human_side_roles)
    human_winned_village_players.where(role: role).count
  elsif role.in?(Player.werewolf_side_roles)
    werewolf_winned_village_players.where(role: role).count
  else
    # 合計: 人間陣営の勝利 + 人狼陣営の勝利
    human_winned_village_players.where(role: Player.human_side_roles).count +
      werewolf_winned_village_players.where(role: Player.werewolf_side_roles).count
  end
end
```

---

## Step 4: プロフィール戦績 UI

**新規ファイル: `src/app/(main)/profile/_components/game-record.tsx`**

### GameRecord コンポーネント

クライアントコンポーネント。`user.stats` を呼び出して戦績テーブルを表示。

```
┌──────────┬────────┬────────┬────────┐
│ 役職     │ 勝利数 │ 対戦数 │ 勝率   │
├──────────┼────────┼────────┼────────┤
│ 村人     │ 3 回   │ 5 回   │ 60.00% │
│ 人狼     │ 2 回   │ 4 回   │ 50.00% │
│ 占い師   │ 1 回   │ 2 回   │ 50.00% │
│ 霊媒師   │ 0 回   │ 0 回   │ -      │
│ 騎士     │ 1 回   │ 1 回   │ 100.00%│
│ 狂人     │ 0 回   │ 1 回   │ 0.00%  │
├──────────┼────────┼────────┼────────┤
│ 合計     │ 7 回   │ 13 回  │ 53.85% │
└──────────┴────────┴────────┴────────┘
```

- 対戦数 0 の役職は勝率 `-` と表示
- shadcn/ui の Table コンポーネントを使用

**修正ファイル: `src/app/(main)/profile/page.tsx`**

- 既存のプロフィール情報の下に `<GameRecord />` を追加

---

## 修正対象ファイル一覧

| ファイル | 操作 | Step |
|---------|------|------|
| `src/server/trpc/routers/game.ts` | 修正（`game.results` 追加） | 1 |
| `src/stores/game-store.ts` | 修正（`showResultsPanel` 追加） | 2 |
| `src/app/(main)/villages/[villageId]/game/_components/room-tabs.tsx` | 修正（「結果」タブ追加） | 2 |
| `src/app/(main)/villages/[villageId]/game/_components/game-client.tsx` | 修正（ResultsPanel 切替表示） | 2 |
| `src/app/(main)/villages/[villageId]/game/_components/results-panel.tsx` | **新規** | 2 |
| `src/server/trpc/routers/user.ts` | 修正（`user.stats` 追加） | 3 |
| `src/app/(main)/profile/_components/game-record.tsx` | **新規** | 4 |
| `src/app/(main)/profile/page.tsx` | 修正（GameRecord 追加） | 4 |

---

## 検証方法

1. `npm run lint` — エラーなし
2. `npm run build` — ビルド成功
3. `code-reviewer` サブエージェントでコードレビュー
4. ブラウザ手動テスト:
   - ゲーム終了後に「結果」タブが表示される
   - 結果タブで日ごとの処刑・襲撃・占い・護衛結果が正しく表示される
   - 投票詳細が showVoteTarget 設定に応じて正しく表示される（投票先 or 得票数）
   - ルームタブと結果タブの切替が正常に動作する
   - プロフィールページに戦績テーブルが表示される
   - 役職別の対戦数・勝利数・勝率が正しい
   - 対戦数 0 の役職は勝率 `-` と表示される
   - ゲーム未参加のユーザーでもプロフィール表示がクラッシュしない
