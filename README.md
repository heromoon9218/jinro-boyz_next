# 人狼BOYZ

オンライン人狼ゲーム — Next.js fullstack アプリケーション

## 技術スタック

- **Next.js 15** (App Router)
- **TypeScript**
- **TailwindCSS 4** + **shadcn/ui**
- **Supabase** (Auth + Postgres + Realtime)
- **Prisma** ORM
- **tRPC v11**
- **Zustand** (クライアント状態管理)
- **Zod** + **React Hook Form** (バリデーション)

## セットアップ

```bash
# 依存関係インストール
npm install

# 環境変数設定
cp .env.example .env
# .env を編集して Supabase の情報を設定
```

### ローカルSupabase開発環境（推奨）

Docker Desktop が必要です。

```bash
# Supabase ローカル環境を初期化（初回のみ）
npx supabase init

# ローカルSupabaseを起動
npx supabase start

# .env.local を作成してローカルの接続情報を設定
# npx supabase status -o env で接続情報を確認可能
```

`.env.local` の設定例:

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<npx supabase status で表示される ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<npx supabase status で表示される SERVICE_ROLE_KEY>
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
DIRECT_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

### DB セットアップ

```bash
# Prisma クライアント生成
npx prisma generate

# マイグレーション適用
npx prisma migrate dev

# 開発サーバー起動
npm run dev
```

> **Note**: `prisma.config.ts` が `.env.local` を優先読み込みするため、Prisma CLI もローカルDBに自動接続します。

## コマンド

```bash
npm run dev          # 開発サーバー (localhost:3000)
npm run build        # プロダクションビルド
npm run lint         # ESLint
npm run test:e2e     # Playwright E2E テスト
npx supabase start   # ローカルSupabase起動
npx supabase stop    # ローカルSupabase停止
npx supabase status  # 接続情報の確認
```

## プロジェクト構成

```
src/
├── app/              # Next.js App Router (ページ + APIルート)
├── components/       # UIコンポーネント (shadcn/ui + カスタム)
├── server/           # サーバーサイドロジック
│   ├── trpc/         # tRPC ルーター
│   ├── game/         # ゲームコアロジック
│   └── db/           # Prisma クライアント
├── lib/              # ユーティリティ (Supabase, tRPC, バリデータ)
├── hooks/            # カスタムフック
├── stores/           # Zustand ストア
└── types/            # 型定義
```
