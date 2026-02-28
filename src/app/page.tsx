import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <main className="flex flex-col items-center gap-8 text-center">
        <h1 className="text-5xl font-bold tracking-tight">人狼BOYZ</h1>
        <p className="max-w-md text-lg text-muted-foreground">
          オンラインで手軽に人狼ゲームを楽しもう
        </p>
        <div className="flex gap-4">
          <Button asChild size="lg">
            <Link href="/login">ログイン</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/signup">サインアップ</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
