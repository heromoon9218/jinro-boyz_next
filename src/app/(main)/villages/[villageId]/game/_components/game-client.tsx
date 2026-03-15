"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/react";
import { useGameRealtime } from "@/lib/hooks/use-game-realtime";
import { useGameStore } from "@/stores/game-store";
import { GameHeader } from "./game-header";
import { PlayerPanel } from "./player-panel";
import { ChatArea } from "./chat-area";
import { ActionPanel } from "./action-panel";
import { GameResult } from "./game-result";

interface GameClientProps {
  villageId: string;
}

export function GameClient({ villageId }: GameClientProps) {
  const trpc = useTRPC();
  const reset = useGameStore((s) => s.reset);

  const { data: gameState, isLoading } = useQuery(
    trpc.game.state.queryOptions({ villageId }),
  );

  useGameRealtime(villageId);

  // Reset store on unmount
  useEffect(() => {
    return () => reset();
  }, [reset]);

  if (isLoading) {
    return (
      <div className="flex h-[calc(100dvh-4rem)] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="flex h-[calc(100dvh-4rem)] items-center justify-center">
        <p className="text-muted-foreground">ゲームデータを取得できません</p>
      </div>
    );
  }

  const isEnded = gameState.villageStatus === "ENDED";

  if (isEnded) {
    return (
      <div className="mx-auto max-w-2xl">
        <GameHeader
          villageName={gameState.villageName}
          day={gameState.day}
          nextUpdateTime={null}
          villageId={villageId}
          isEnded
        />
        <GameResult villageId={villageId} />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col">
      <GameHeader
        villageName={gameState.villageName}
        day={gameState.day}
        nextUpdateTime={gameState.nextUpdateTime}
        villageId={villageId}
        isEnded={false}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Player panel - sidebar */}
        <div className="w-48 shrink-0 overflow-y-auto border-r p-2">
          <PlayerPanel
            players={gameState.players}
            myRole={gameState.myRole}
            myPlayerId={gameState.myPlayerId}
            isEnded={false}
            canSelectTarget={gameState.myStatus === "ALIVE"}
          />
        </div>

        {/* Chat area - main content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <ChatArea
            rooms={gameState.rooms}
            myRole={gameState.myRole}
            myStatus={gameState.myStatus}
            isEnded={false}
          />
        </div>
      </div>

      {/* Action panel - bottom */}
      <ActionPanel
        villageId={villageId}
        myRole={gameState.myRole}
        myStatus={gameState.myStatus}
        myRecord={gameState.myRecord}
        players={gameState.players}
        divineResults={gameState.divineResults}
        psychicResults={gameState.psychicResults}
      />
    </div>
  );
}
