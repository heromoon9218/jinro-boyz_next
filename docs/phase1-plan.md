# Phase 1: 認証 + ユーザー管理 実装プラン

**ステータス**: 完了

## Context

Phase 0でNext.jsプロジェクトの基盤（Prisma スキーマ、tRPC、Supabase クライアント、shadcn/ui）が完成済み。
Phase 1では**Supabase Auth統合、ログイン/サインアップUI、プロフィールCRUD**を実装し、認証付きアプリとして動作する状態にする。

---

## Step 0: 環境セットアップ

1. `.env` にSupabase接続情報を設定
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `DATABASE_URL`, `DIRECT_URL`（Supabase Postgres接続文字列）
2. `npx prisma migrate dev --name init` で初回マイグレーション実行
3. 動作確認（DBテーブル作成成功）

---

## Step 1: Server Actions で認証フロー実装

Server Actionsを使ったシンプルな認証（tRPCルーターは不要、Supabase AuthのAPIを直接呼ぶ）。

**新規ファイル: `src/app/(auth)/actions.ts`**
- `signup(formData)` — Supabase `signUp` + Prisma User/Profile 作成 → `/villages` リダイレクト
- `login(formData)` — Supabase `signInWithPassword` → `/villages` リダイレクト
- `logout()` — Supabase `signOut` → `/login` リダイレクト

**理由**: 認証はフォーム送信→リダイレクトのシンプルなフローで、tRPCを通す必要がない。Server Actionsが最適。

---

## Step 2: ログイン/サインアップフォーム実装

**修正ファイル: `src/app/(auth)/login/page.tsx`**
- shadcn/ui `Card` + `Form` + `Input` + `Button`
- React Hook Form + Zod (`loginSchema` from `src/lib/validators/auth.ts`)
- Server Action 呼び出し、エラーはsonnerトーストで表示

**修正ファイル: `src/app/(auth)/signup/page.tsx`**
- 同上 (`signupSchema`)
- username, email, password, confirmPassword の4フィールド

---

## Step 3: tRPC user ルーター

**新規ファイル: `src/server/trpc/routers/user.ts`**
- `me` (protected) — 認証ユーザーの User + Profile を取得
- `updateProfile` (protected) — Profile.comment を更新

**修正ファイル: `src/server/trpc/routers/_app.ts`**
- `user` ルーターを追加

---

## Step 4: メインレイアウト改善（ログアウト + ユーザー表示）

**修正ファイル: `src/app/(main)/layout.tsx`**
- サーバーコンポーネントでSupabase `getUser()` → ユーザー名表示
- ログアウトボタン追加（Server Action呼び出し）
- 未認証時は「ログイン」リンクを表示

**新規ファイル: `src/app/(main)/logout-button.tsx`**
- クライアントコンポーネントとして分離

---

## Step 5: プロフィールページ

**修正ファイル: `src/app/(main)/profile/page.tsx`**
- サーバーコンポーネントで現在のユーザー情報を取得して表示
- コメント編集フォーム（クライアントコンポーネント）
- tRPC `user.updateProfile` で保存

**新規ファイル: `src/app/(main)/profile/profile-form.tsx`**
- tRPC mutation でコメント保存

---

## Step 6: 公開ルート設定

**修正ファイル: `src/lib/supabase/middleware.ts`**
- `/villages` を公開ルートに追加（未認証でも閲覧可能）

---

## 修正対象ファイル一覧

| ファイル | 操作 |
|---------|------|
| `.env` | 修正（Supabase接続情報入力） |
| `src/app/(auth)/actions.ts` | **新規** |
| `src/app/(auth)/login/page.tsx` | 修正 |
| `src/app/(auth)/signup/page.tsx` | 修正 |
| `src/server/trpc/routers/user.ts` | **新規** |
| `src/server/trpc/routers/_app.ts` | 修正 |
| `src/app/(main)/layout.tsx` | 修正 |
| `src/app/(main)/logout-button.tsx` | **新規** |
| `src/app/(main)/profile/page.tsx` | 修正 |
| `src/app/(main)/profile/profile-form.tsx` | **新規** |
| `src/lib/supabase/middleware.ts` | 修正 |

---

## 検証方法

1. `npx prisma migrate dev` — マイグレーション成功
2. `npm run build` — ビルド成功
3. ブラウザ手動テスト:
   - `/signup` でアカウント作成 → `/villages` にリダイレクト
   - ログアウト → `/login` にリダイレクト
   - `/login` でログイン → `/villages` にリダイレクト
   - `/profile` でコメント編集 → 保存成功
   - 未認証で `/villages` アクセス → 閲覧可能（ログインリンク表示）
   - 未認証で `/profile` アクセス → `/login` にリダイレクト
