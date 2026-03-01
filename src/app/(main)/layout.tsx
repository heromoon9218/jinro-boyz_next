import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/server/db";
import { LogoutButton } from "./logout-button";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  let username: string | null = null;
  if (authUser) {
    const user = await db.user.findUnique({
      where: { authId: authUser.id },
      select: { username: true },
    });
    username = user?.username ?? null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link href="/villages" className="text-lg font-bold">
            人狼BOYZ
          </Link>
          <nav className="flex items-center gap-4">
            <Link
              href="/villages"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              村一覧
            </Link>
            {username ? (
              <>
                <Link
                  href="/profile"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  プロフィール
                </Link>
                <Link
                  href="/settings"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  設定
                </Link>
                <span className="text-sm font-medium">{username}</span>
                <LogoutButton />
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  ログイン
                </Link>
                <Link
                  href="/signup"
                  className="text-sm font-medium text-foreground hover:text-foreground"
                >
                  新規登録
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
