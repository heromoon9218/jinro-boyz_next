"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/server/db";
import { z } from "zod";

const updateEmailSchema = z.object({
  newEmail: z.string().email("有効なメールアドレスを入力してください"),
});

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

  try {
    await db.user.update({
      where: { authId: authUser.id },
      data: { email: parsed.data.newEmail },
    });
  } catch (dbError) {
    return {
      error:
        "メールアドレスの更新中にエラーが発生しました。しばらく経ってから再度お試しください。",
    };
  }

  return {};
}
