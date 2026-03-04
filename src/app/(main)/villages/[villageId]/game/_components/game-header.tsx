"use client";

import { Badge } from "@/components/ui/badge";
import { CountdownTimer } from "./countdown-timer";

interface GameHeaderProps {
  villageName: string;
  day: number;
  nextUpdateTime: Date | null;
  villageId: string;
  isEnded: boolean;
}

export function GameHeader({
  villageName,
  day,
  nextUpdateTime,
  villageId,
  isEnded,
}: GameHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-bold">{villageName}</h1>
        <Badge variant="secondary">Day {day}</Badge>
      </div>
      {!isEnded && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>残り時間:</span>
          <CountdownTimer
            nextUpdateTime={nextUpdateTime}
            villageId={villageId}
          />
        </div>
      )}
    </div>
  );
}
