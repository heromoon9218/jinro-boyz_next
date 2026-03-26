"use client";

import type { RoomType } from "@/generated/prisma";
import { useGameStore } from "@/stores/game-store";
import { cn } from "@/lib/utils";

interface RoomTabsProps {
  rooms: { id: string; type: RoomType }[];
  isGameEnded: boolean;
}

const ROOM_LABELS: Record<RoomType, string> = {
  MAIN: "メイン",
  WOLF: "人狼",
  DEAD: "霊界",
};

export function RoomTabs({ rooms, isGameEnded }: RoomTabsProps) {
  const { currentRoom, showResultsPanel, setCurrentRoom, setShowResultsPanel } =
    useGameStore();

  return (
    <div className="flex gap-1 border-b px-2">
      {rooms.map((room) => (
        <button
          key={room.id}
          onClick={() => setCurrentRoom(room.type)}
          className={cn(
            "px-3 py-2 text-sm font-medium transition-colors",
            currentRoom === room.type && !showResultsPanel
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {ROOM_LABELS[room.type]}
        </button>
      ))}
      {isGameEnded && (
        <button
          onClick={() => setShowResultsPanel(true)}
          className={cn(
            "px-3 py-2 text-sm font-medium transition-colors",
            showResultsPanel
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          結果
        </button>
      )}
    </div>
  );
}
