"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { VillageStatus } from "@/generated/prisma";
import { toast } from "sonner";

interface PlayerListProps {
  players: {
    id: string;
    username: string;
    userId: string;
    user: { id: string; username: string };
  }[];
  villageId: string;
  villageStatus: VillageStatus;
  isOwner: boolean;
  ownerUserId: string;
}

export function PlayerList({
  players,
  villageId,
  villageStatus,
  isOwner,
  ownerUserId,
}: PlayerListProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const kickMutation = useMutation(
    trpc.village.kick.mutationOptions({
      onSuccess: () => {
        toast.success("プレイヤーをキックしました");
        queryClient.invalidateQueries({ queryKey: [["village"]] });
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold">
        プレイヤー ({players.length}人)
      </h2>
      {players.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          まだ参加者がいません
        </p>
      ) : (
        <ul className="space-y-2">
          {players.map((player) => (
            <li
              key={player.id}
              className="flex items-center justify-between rounded-lg border px-4 py-2"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{player.username}</span>
                {player.userId === ownerUserId && (
                  <Badge variant="outline" className="text-xs">
                    村主
                  </Badge>
                )}
              </div>
              {isOwner &&
                villageStatus === "NOT_STARTED" &&
                player.userId !== ownerUserId && (
                  <Button
                    variant="destructive"
                    size="xs"
                    disabled={kickMutation.isPending}
                    onClick={() =>
                      kickMutation.mutate({
                        villageId,
                        playerId: player.id,
                      })
                    }
                  >
                    キック
                  </Button>
                )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
