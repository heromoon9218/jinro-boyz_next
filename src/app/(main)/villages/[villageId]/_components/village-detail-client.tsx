"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  VILLAGE_STATUS_LABELS,
  VILLAGE_STATUS_VARIANTS,
  formatDiscussionTime,
  formatScheduledStart,
} from "@/types/village-helpers";
import { PlayerList } from "./player-list";
import { VillageActions } from "./village-actions";

interface VillageDetailClientProps {
  villageId: string;
}

export function VillageDetailClient({ villageId }: VillageDetailClientProps) {
  const trpc = useTRPC();

  const { data: village, isLoading } = useQuery(
    trpc.village.byId.queryOptions({ id: villageId }),
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-32 animate-pulse rounded-xl border bg-muted" />
      </div>
    );
  }

  if (!village) {
    return <p className="text-muted-foreground">村が見つかりません</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{village.name}</h1>
          <Badge variant={VILLAGE_STATUS_VARIANTS[village.status]}>
            {VILLAGE_STATUS_LABELS[village.status]}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          作成者: {village.user.username}
        </p>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <div>
          <span className="text-muted-foreground">定員: </span>
          {village.players.length}/{village.playerNum}人
        </div>
        <div>
          <span className="text-muted-foreground">議論時間: </span>
          {formatDiscussionTime(village.discussionTime)}
        </div>
        <div>
          <span className="text-muted-foreground">投票先公開: </span>
          {village.showVoteTarget ? "あり" : "なし"}
        </div>
        {village.scheduledStartAt && (
          <div>
            <span className="text-muted-foreground">開始予定: </span>
            {formatScheduledStart(village.scheduledStartAt)}
          </div>
        )}
        {village.hasPassword && (
          <div>
            <span className="text-muted-foreground">合言葉: </span>あり
          </div>
        )}
      </div>

      <VillageActions
        village={village}
        isLoggedIn={village.isLoggedIn}
        isOwner={village.isOwner}
        isParticipant={village.isParticipant}
      />

      <Separator />

      <PlayerList
        players={village.players}
        villageId={village.id}
        villageStatus={village.status}
        isOwner={village.isOwner}
        ownerUserId={village.user.id}
      />
    </div>
  );
}
