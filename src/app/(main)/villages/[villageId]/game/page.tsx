export default async function GamePage({
  params,
}: {
  params: Promise<{ villageId: string }>;
}) {
  const { villageId } = await params;

  return (
    <div>
      <h1 className="text-2xl font-bold">ゲーム画面</h1>
      <p className="mt-2 text-muted-foreground">
        村ID: {villageId} — ゲーム画面は Phase 3 で実装予定
      </p>
    </div>
  );
}
