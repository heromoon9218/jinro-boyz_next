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

# Prisma クライアント生成
npx prisma generate

# DB マイグレーション
npx prisma migrate dev

# 開発サーバー起動
npm run dev
```

## コマンド

```bash
npm run dev          # 開発サーバー (localhost:3000)
npm run build        # プロダクションビルド
npm run lint         # ESLint
npm run test:e2e     # Playwright E2E テスト
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
