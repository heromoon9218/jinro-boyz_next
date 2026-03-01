# Phase 2: 村管理機能 実装プラン

**ステータス**: 完了

## Context

Phase 1で認証・ユーザー管理が完成済み。
Phase 2では**村の一覧表示、作成、参加/退出、開始/廃村/キック、開始予定表示**を実装し、ゲーム開始前のロビー機能を完成させる。

---

## 実装済み機能

### 村一覧ページ (`/villages`)

- アクティブ村（`NOT_STARTED` / `IN_PLAY`）と終了村（`ENDED` / `RUINED`）のタブ切り替え
- ページネーション対応
- 村カードに定員・議論時間・作成者・パスワード有無・開始予定を表示

### 村作成ダイアログ

- 村名（1〜50文字）
- 定員（5〜16人セレクト）
- 議論時間（1〜1440分の数値入力、DB保存時は秒に変換）
- パスワード（任意）
- 投票先公開（トグルスイッチ）
- 開始予定（任意、datetime-local入力）

### 村詳細ページ (`/villages/[villageId]`)

- 村名・ステータス・作成者・定員・議論時間・投票先公開・パスワード有無・開始予定を表示
- 参加プレイヤー一覧（村主にはキックボタン付き）

### 参加 / 退出

- 未参加ユーザーは「参加する」ボタンで参加（パスワード付き村はダイアログ表示）
- 参加済みユーザーは「退出する」ボタンで退出（村主は退出不可）
- 定員超過・開始済み・ブラックリスト登録時はエラー

### ゲーム開始

- 村主のみが「ゲームを開始」ボタンで開始可能
- 定員に達している場合のみ開始可能
- ロール自動割り当て（村人、人狼、占い師、霊媒師、騎士、狂人）
- MAIN / WOLF / DEAD ルーム自動作成
- Day 1 の Record を全プレイヤー分作成

### 廃村

- 村主のみが「廃村にする」ボタンで廃村可能
- 確認ダイアログ付き
- 終了済み/廃村済みの村では実行不可

### キック

- 村主のみが開始前の村でプレイヤーをキック可能
- キックされたプレイヤーはブラックリストに追加（再参加不可）
- 自分自身はキック不可

### 開始予定表示

- 村作成時に任意で開始予定日時を設定可能
- 村一覧カード・村詳細ページに「開始予定: 3/15 14:30」形式で表示
- 情報表示のみ（自動開始なし）、ゲーム開始は手動

---

## 主要ファイル

| ファイル | 役割 |
|---------|------|
| `prisma/schema.prisma` | Village / Player / Room / Record 等のスキーマ定義 |
| `src/lib/validators/village.ts` | Zod バリデーションスキーマ（作成・参加・退出・開始・廃村・キック） |
| `src/server/trpc/routers/village.ts` | tRPC ルーター（list / byId / create / join / leave / start / ruin / kick） |
| `src/server/game/assign-roles.ts` | ロール割り当てロジック（純粋関数） |
| `src/types/village-helpers.ts` | ステータスラベル・議論時間フォーマット・開始予定フォーマット |
| `src/app/(main)/villages/page.tsx` | 村一覧ページ（サーバーコンポーネント） |
| `src/app/(main)/villages/_components/village-list-client.tsx` | 村一覧クライアントコンポーネント |
| `src/app/(main)/villages/_components/village-card.tsx` | 村カードコンポーネント |
| `src/app/(main)/villages/_components/create-village-dialog.tsx` | 村作成ダイアログ |
| `src/app/(main)/villages/[villageId]/page.tsx` | 村詳細ページ（サーバーコンポーネント） |
| `src/app/(main)/villages/[villageId]/_components/village-detail-client.tsx` | 村詳細クライアントコンポーネント |
| `src/app/(main)/villages/[villageId]/_components/village-actions.tsx` | 村アクションボタン群 |
| `src/app/(main)/villages/[villageId]/_components/player-list.tsx` | プレイヤー一覧 |

---

## 検証方法

1. `npx prisma migrate dev` — マイグレーション成功
2. `npm run lint` — エラーなし
3. `npm run build` — ビルド成功
4. ブラウザ手動テスト:
   - 村一覧でアクティブ/終了タブ切り替え
   - 村作成ダイアログで各フィールド入力 → 作成 → 村詳細にリダイレクト
   - 開始予定を設定して作成 → 村一覧・村詳細に表示
   - 開始予定を空にして作成 → 非表示
   - 議論時間に1〜1440分の範囲で入力可能
   - 別ユーザーで参加 → プレイヤー一覧に表示
   - パスワード付き村に参加 → パスワードダイアログ表示
   - 参加済みユーザーが退出 → プレイヤー一覧から削除
   - 定員到達 → 村主がゲーム開始 → ステータス IN_PLAY に変更
   - 村主が廃村 → ステータス RUINED に変更
   - 村主がプレイヤーをキック → ブラックリスト追加・再参加不可
