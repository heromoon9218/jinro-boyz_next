import type { VillageStatus } from "@prisma/client";

export const VILLAGE_STATUS_LABELS: Record<VillageStatus, string> = {
  NOT_STARTED: "募集中",
  IN_PLAY: "進行中",
  ENDED: "終了",
  RUINED: "廃村",
};

export const VILLAGE_STATUS_VARIANTS: Record<
  VillageStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  NOT_STARTED: "default",
  IN_PLAY: "secondary",
  ENDED: "outline",
  RUINED: "destructive",
};

export function formatDiscussionTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (remainingSeconds === 0) return `${minutes}分`;
  return `${minutes}分${remainingSeconds}秒`;
}
