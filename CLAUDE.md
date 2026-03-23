# CLAUDE.md

## Project Overview

**人狼BOYZ** — Next.js fullstack オンライン人狼ゲーム

**Stack**: Next.js 16 (App Router), TypeScript, TailwindCSS 4 + shadcn/ui, Supabase (Auth + Postgres + Realtime), Prisma 7, tRPC v11, Zustand, Zod + React Hook Form

## Commands

```bash
# 開発サーバー
npm run dev

# ビルド
npm run build

# Lint
npm run lint

# Prisma クライアント生成
npx prisma generate

# Prisma マイグレーション
npx prisma migrate dev

# メール変更トリガー（初回セットアップ時のみ）
# Supabase Dashboard > SQL Editor で scripts/sync_user_email_on_auth_change.sql を実行

# テスト (Vitest)
npm run test

# E2E テスト (Playwright)
npm run test:e2e
```

## ローカルSupabase開発環境

Docker Desktop 起動済みの前提。

```bash
# 起動
npm run supabase:start

# 停止（旧イメージの自動クリーンアップ付き）
npm run supabase:stop

# ステータス確認（接続情報を表示）
npx supabase status

# Supabase Studio（ローカルDB管理画面）
# http://127.0.0.1:54323
```

- `.env.local` にローカルSupabaseの接続情報を設定済み（`.env` の本番値を上書き）
- `prisma.config.ts` が `.env.local` を優先読み込みするため、Prisma CLI もそのまま使える

### Mandatory post-edit checks

`src/` 配下のファイル編集後:
1. `npm run lint`
2. `npm run build`
3. `code-reviewer` サブエージェント（`.claude/agents/code-reviewer.md`）でコードレビューを実行

## Architecture

- `src/app/` — Next.js App Router (pages + API routes)
- `src/server/trpc/` — tRPC routers
- `src/server/game/` — Game core logic (pure functions)
- `src/server/db/` — Prisma client singleton
- `src/lib/supabase/` — Supabase client (browser + server + middleware)
- `src/lib/trpc/` — tRPC client + React Query provider
- `src/lib/validators/` — Zod schemas
- `src/lib/hooks/` — Custom React hooks (auth, realtime)
- `src/components/ui/` — shadcn/ui components
- `src/stores/` — Zustand stores
- `src/types/` — Type definitions + game constants

## Key Files

- `prisma.config.ts` — `.env.local` を優先読み込み（Prisma CLI用）
- `next.config.ts` — Next.js設定
- `playwright.config.ts` — E2Eテスト設定
- `vitest.config.ts` — ユニットテスト設定
- `components.json` — shadcn/ui + TailwindCSS設定
- `scripts/sync_user_email_on_auth_change.sql` — Supabase Auth トリガー（初回のみ）

## Domain Model

| Entity | Role |
|--------|------|
| `Village` | One game instance; statuses: `NOT_STARTED → IN_PLAY → ENDED/RUINED` |
| `Player` | User's participation in a Village; has role + alive/dead status |
| `Room` | Chat room with type: `MAIN` / `WOLF` / `DEAD` |
| `Post` | Chat message in a Room |
| `Record` | Per-player-per-day actions (vote, attack, divine, guard) |
| `Result` | Per-day resolved outcomes |

**Roles**: VILLAGER (村人), WEREWOLF (人狼), FORTUNE_TELLER (占い師), PSYCHIC (霊媒師), BODYGUARD (騎士), MADMAN (狂人)

**Victory**: Humans win when all werewolves eliminated; werewolves win when `living_wolves ≥ living_humans`.
