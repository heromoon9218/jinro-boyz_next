"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ROLE_DISPLAY_NAMES } from "@/types/game";
import type { Role, PlayerStatus } from "@/generated/prisma";
import { useGameStore } from "@/stores/game-store";

interface PlayerInfo {
  id: string;
  username: string;
  status: PlayerStatus;
  isMe: boolean;
}

interface PlayerPanelProps {
  players: PlayerInfo[];
  myRole: Role;
  myPlayerId: string;
  isEnded: boolean;
  canSelectTarget: boolean;
}

export function PlayerPanel({
  players,
  myRole,
  myPlayerId,
  isEnded,
  canSelectTarget,
}: PlayerPanelProps) {
  const { selectedTarget, setSelectedTarget } = useGameStore();

  function handleClick(playerId: string) {
    if (!canSelectTarget) return;
    if (playerId === myPlayerId) return;
    const player = players.find((p) => p.id === playerId);
    if (!player || player.status !== "ALIVE") return;

    setSelectedTarget(selectedTarget === playerId ? null : playerId);
  }

  return (
    <div className="space-y-1">
      <h2 className="px-1 text-sm font-semibold">
        プレイヤー ({players.filter((p) => p.status === "ALIVE").length}/
        {players.length})
      </h2>
      <div className="space-y-0.5">
        {players.map((player) => (
          <button
            key={player.id}
            type="button"
            disabled={
              !canSelectTarget ||
              player.id === myPlayerId ||
              player.status !== "ALIVE"
            }
            onClick={() => handleClick(player.id)}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
              player.status === "DEAD" && "opacity-50",
              canSelectTarget &&
                player.id !== myPlayerId &&
                player.status === "ALIVE" &&
                "hover:bg-accent cursor-pointer",
              selectedTarget === player.id && "bg-accent ring-1 ring-ring",
            )}
          >
            <span
              className={cn(
                "size-2 shrink-0 rounded-full",
                player.status === "ALIVE" ? "bg-green-500" : "bg-gray-400",
              )}
            />
            <span className="flex-1 truncate">
              {player.username}
              {player.isMe && (
                <span className="ml-1 text-xs text-muted-foreground">
                  (あなた)
                </span>
              )}
            </span>
            {player.isMe && !isEnded && (
              <Badge variant="outline" className="text-[10px]">
                {ROLE_DISPLAY_NAMES[myRole]}
              </Badge>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
