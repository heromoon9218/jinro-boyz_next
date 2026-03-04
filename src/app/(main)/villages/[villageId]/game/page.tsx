import { GameClient } from "./_components/game-client";

export default async function GamePage(props: {
  params: Promise<{ villageId: string }>;
}) {
  const { villageId } = await props.params;

  return <GameClient villageId={villageId} />;
}
