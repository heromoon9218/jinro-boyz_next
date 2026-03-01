"use server";

import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { db } from "@/server/db";
import { loginSchema, signupSchema } from "@/lib/validators/auth";

export async function signup(formData: {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}) {
  const parsed = signupSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { username, email, password } = parsed.data;

  // Check username uniqueness
  const existingUser = await db.user.findUnique({ where: { username } });
  if (existingUser) {
    return { error: "このユーザー名は既に使われています" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return { error: error.message };
  }

  if (!data.user) {
    return { error: "アカウントの作成に失敗しました" };
  }

  // 既存メールで signUp した場合、Supabase は error を返さず identities が空の user を返す。
  // このまま進むと Prisma のユニーク制約で失敗し、ロールバックで既存ユーザーの Auth を削除してしまう脆弱性がある。
  if (!data.user.identities?.length) {
    return { error: "このメールアドレスは既に登録されています" };
  }

  const authUserId = data.user.id;

  try {
    await db.user.create({
      data: {
        authId: authUserId,
        username,
        email,
        profile: { create: {} },
      },
    });
  } catch (dbError) {
    // Prisma 作成失敗時: Supabase auth ユーザーを削除してロールバック
    // 残すと「再登録不可・ログイン不可」の unrecoverable 状態になる
    try {
      const admin = createAdminClient();
      await admin.auth.admin.deleteUser(authUserId);
    } catch (rollbackError) {
      // ロールバック失敗はログに残すが、ユーザーには Prisma エラーを返す
      console.error(
        "[signup] Failed to rollback auth user after Prisma error:",
        rollbackError,
      );
    }
    try {
      await supabase.auth.signOut();
    } catch (signOutError) {
      // signOut 失敗はログに残すが、ユーザーには Prisma エラーを返す
      console.error("[signup] Failed to signOut after Prisma error:", signOutError);
    }

    const isUniqueViolation =
      dbError instanceof Prisma.PrismaClientKnownRequestError &&
      dbError.code === "P2002";
    return {
      error: isUniqueViolation
        ? "このユーザー名またはメールアドレスは既に使われています。別のものをお試しください。"
        : "アカウントの作成中にエラーが発生しました。しばらく経ってから再度お試しください。",
    };
  }

  redirect("/villages");
}

export async function login(formData: { email: string; password: string }) {
  const parsed = loginSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { email, password } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "メールアドレスまたはパスワードが正しくありません" };
  }

  redirect("/villages");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
