"use client";

import Link from "next/link";
import { Lock, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { VillageStatus } from "@prisma/client";
import {
  VILLAGE_STATUS_LABELS,
  VILLAGE_STATUS_VARIANTS,
  formatDiscussionTime,
  formatScheduledStart,
} from "@/types/village-helpers";

interface VillageCardProps {
  village: {
    id: string;
    name: string;
    playerNum: number;
    discussionTime: number;
    status: VillageStatus;
    scheduledStartAt: Date | null;
    hasPassword: boolean;
    user: { username: string };
    _count: { players: number };
  };
}

export function VillageCard({ village }: VillageCardProps) {
  return (
    <Link href={`/villages/${village.id}`}>
      <Card className="transition-colors hover:bg-accent/50">
        <CardHeader className="pb-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{village.name}</CardTitle>
            <Badge variant={VILLAGE_STATUS_VARIANTS[village.status]}>
              {VILLAGE_STATUS_LABELS[village.status]}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="size-3.5" />
              {village._count.players}/{village.playerNum}人
            </span>
            <span>議論 {formatDiscussionTime(village.discussionTime)}</span>
            {village.scheduledStartAt && (
              <span>開始予定: {formatScheduledStart(village.scheduledStartAt)}</span>
            )}
            <span>作成者: {village.user.username}</span>
            {village.hasPassword && (
              <span className="flex items-center gap-1">
                <Lock className="size-3.5" />
                パスワード
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
