"use client";

import type { PlayerStatus } from "@/generated/prisma";
import { Badge } from "@/components/ui/badge";
import { ROLE_DISPLAY_NAMES } from "@/types/game";

interface Player {
  id: string;
  username: string;
  status: PlayerStatus;
  role?: string;
}

interface PlayerListPanelProps {
  players: Player[];
  isGameEnded: boolean;
}

export function PlayerListPanel({
  players,
  isGameEnded,
}: PlayerListPanelProps) {
  return (
    <div className="border-t px-3 py-2">
      <div className="flex flex-wrap gap-2">
        {players.map((player) => (
          <div
            key={player.id}
            className="flex items-center gap-1 text-xs"
          >
            <span
              className={
                player.status === "DEAD"
                  ? "text-muted-foreground line-through"
                  : ""
              }
            >
              {player.username}
            </span>
            {isGameEnded && player.role && (
              <Badge variant="outline" className="text-[10px] px-1 py-0">
                {ROLE_DISPLAY_NAMES[player.role] ?? player.role}
              </Badge>
            )}
            {player.status === "DEAD" && (
              <Badge variant="destructive" className="text-[10px] px-1 py-0">
                死亡
              </Badge>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
