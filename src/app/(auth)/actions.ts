"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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

  // Create User + Profile in Prisma
  await db.user.create({
    data: {
      authId: data.user.id,
      username,
      email,
      profile: { create: {} },
    },
  });

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
