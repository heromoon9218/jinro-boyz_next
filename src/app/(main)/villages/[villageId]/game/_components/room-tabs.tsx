"use client";

import type { RoomType } from "@/generated/prisma";
import { useGameStore } from "@/stores/game-store";
import { cn } from "@/lib/utils";

interface RoomTabsProps {
  rooms: { id: string; type: RoomType }[];
}

const ROOM_LABELS: Record<RoomType, string> = {
  MAIN: "メイン",
  WOLF: "人狼",
  DEAD: "霊界",
};

export function RoomTabs({ rooms }: RoomTabsProps) {
  const { currentRoom, setCurrentRoom } = useGameStore();

  return (
    <div className="flex gap-1 border-b px-2">
      {rooms.map((room) => (
        <button
          key={room.id}
          onClick={() => setCurrentRoom(room.type)}
          className={cn(
            "px-3 py-2 text-sm font-medium transition-colors",
            currentRoom === room.type
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {ROOM_LABELS[room.type]}
        </button>
      ))}
    </div>
  );
}
