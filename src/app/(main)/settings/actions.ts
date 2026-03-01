"use server";

import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const updateEmailSchema = z.object({
  newEmail: z.string().email("有効なメールアドレスを入力してください"),
});

/**
 * メールアドレス変更をリクエストする。
 * Supabase Auth が確認メールを送信し、ユーザーがリンクをクリックして確認するまで
 * 実際のメールアドレスは変わらない。
 * public.users の email は auth.users の email 変更時に DB トリガーで同期されるため、
 * ここでは Supabase へのリクエストのみ行う。
 */
export async function updateEmail(newEmail: string) {
  const parsed = updateEmailSchema.safeParse({ newEmail });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return { error: "ログインが必要です" };
  }

  const { error } = await supabase.auth.updateUser({ email: parsed.data.newEmail });

  if (error) {
    return { error: error.message };
  }

  return {};
}
