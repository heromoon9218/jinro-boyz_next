"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/react";
import { useGameStore } from "@/stores/game-store";
import { useRealtimeVillage } from "@/lib/hooks/use-realtime-village";
import { ROLE_DISPLAY_NAMES } from "@/types/game";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GameHeader } from "./game-header";
import { RoomTabs } from "./room-tabs";
import { ChatArea } from "./chat-area";
import { SkillPanel } from "./skill-panel";
import { PlayerListPanel } from "./player-list-panel";
import { ResultsPanel } from "./results-panel";
import type { Role } from "@/generated/prisma";

interface GameClientProps {
  villageId: string;
}

export function GameClient({ villageId }: GameClientProps) {
  const trpc = useTRPC();
  const { currentRoom, showSkillPanel, showResultsPanel, toggleSkillPanel, reset } =
    useGameStore();

  useEffect(() => {
    reset();
  }, [villageId, reset]);

  useRealtimeVillage(villageId);

  const { data, isLoading, error, refetch } = useQuery(
    trpc.game.state.queryOptions({ villageId }),
  );

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
        <p className="text-muted-foreground">読み込み中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] flex-col items-center justify-center gap-3">
        <p className="text-destructive">データの取得に失敗しました</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          再読み込み
        </Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
        <p className="text-muted-foreground">村が見つかりません</p>
      </div>
    );
  }

  const { village, currentPlayer, players, rooms, currentRecord } = data;
  const isGameEnded =
    village.status === "ENDED" || village.status === "RUINED";
  const isAlive = currentPlayer?.status === "ALIVE";
  const isInPlay = village.status === "IN_PLAY";

  // 現在選択中のルームを取得
  const activeRoom = rooms.find((r) => r.type === currentRoom) ?? rooms[0];

  // 現在のルームで発言可能かを判定
  const canSpeak =
    isInPlay &&
    !!currentPlayer &&
    (() => {
      if (!activeRoom) return false;
      if (activeRoom.type === "MAIN") return isAlive;
      if (activeRoom.type === "WOLF")
        return isAlive && currentPlayer.role === "WEREWOLF";
      if (activeRoom.type === "DEAD")
        return currentPlayer.status === "DEAD";
      return false;
    })();

  // スキルパネルはゲーム中の生存プレイヤーのみ表示
  const canUseSkills = isInPlay && isAlive && !!currentPlayer;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <GameHeader village={village} />

      {/* 現在のプレイヤーの役職バッジ */}
      {currentPlayer && (
        <div className="flex items-center gap-2 border-b px-4 py-1.5">
          <span className="text-xs text-muted-foreground">あなたの役職:</span>
          <Badge variant="outline" className="text-xs">
            {ROLE_DISPLAY_NAMES[currentPlayer.role] ?? currentPlayer.role}
          </Badge>
          {currentPlayer.status === "DEAD" && (
            <Badge variant="destructive" className="text-xs">
              死亡
            </Badge>
          )}
        </div>
      )}

      <RoomTabs rooms={rooms} isGameEnded={isGameEnded} />

      {/* メインコンテンツエリア */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {showResultsPanel && isGameEnded ? (
          <ResultsPanel villageId={villageId} />
        ) : showSkillPanel && canUseSkills ? (
          <SkillPanel
            villageId={villageId}
            currentPlayerId={currentPlayer!.id}
            currentRole={currentPlayer!.role as Role}
            players={players}
            currentRecord={currentRecord}
            day={village.day}
          />
        ) : (
          activeRoom && (
            <ChatArea key={activeRoom.id} roomId={activeRoom.id} canSpeak={canSpeak} />
          )
        )}
      </div>

      {/* アクション切替ボタン + プレイヤー一覧 */}
      <div>
        {canUseSkills && (
          <div className="flex justify-end border-t px-3 py-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={toggleSkillPanel}
            >
              {showSkillPanel ? "チャットに戻る" : "アクション"}
            </Button>
          </div>
        )}
        <PlayerListPanel
          players={players}
          isGameEnded={isGameEnded}
        />
      </div>
    </div>
  );
}
