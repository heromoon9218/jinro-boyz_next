import { createClient } from "@/lib/supabase/server";
import { db } from "@/server/db";
import { redirect } from "next/navigation";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect("/login");
  }

  const user = await db.user.findUnique({
    where: { authId: authUser.id },
    include: { profile: true },
  });

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">プロフィール</h1>
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          ユーザー名:{" "}
          <span className="font-medium text-foreground">{user.username}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          メールアドレス:{" "}
          <span className="font-medium text-foreground">{user.email}</span>
        </p>
      </div>
      <ProfileForm initialComment={user.profile?.comment ?? ""} />
    </div>
  );
}
