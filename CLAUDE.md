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

# テスト (Vitest)
npm run test

# E2E テスト (Playwright)
npm run test:e2e

# シードデータ投入（E2Eテストの前提）
npx prisma db seed

# ローカルSupabase 起動 / 停止（Docker Desktop 起動済みの前提）
npm run supabase:start
npm run supabase:stop

# Supabase Studio（ローカルDB管理画面）: http://127.0.0.1:54323

# メール変更トリガー（初回セットアップ時のみ）
# Supabase Dashboard > SQL Editor で scripts/sync_user_email_on_auth_change.sql を実行
```

- `.env.local` にローカルSupabaseの接続情報を設定済み（`.env` の本番値を上書き）
- `prisma.config.ts` が `.env.local` を優先読み込みするため、Prisma CLI もそのまま使える

## Architecture

- `src/app/` — Next.js App Router (pages + API routes)
- `e2e/` — Playwright E2E tests (seed data required)
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

- `prisma/seed.ts` — E2Eテスト用シードデータ（8ユーザー + 3村: NOT_STARTED/IN_PLAY/ENDED）。共通パスワード: `password123`
- `prisma.config.ts` — `.env.local` を優先読み込み（Prisma CLI用）
- `next.config.ts` — Next.js設定
- `playwright.config.ts` — E2Eテスト設定
- `vitest.config.ts` — ユニットテスト設定
- `components.json` — shadcn/ui + TailwindCSS設定
- `scripts/sync_user_email_on_auth_change.sql` — Supabase Auth トリガー（初回のみ）
