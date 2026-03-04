"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useGameStore } from "@/stores/game-store";
import type { Role, PlayerStatus } from "@/generated/prisma";
import { toast } from "sonner";

interface ActionPanelProps {
  villageId: string;
  myRole: Role;
  myStatus: PlayerStatus;
  myRecord: {
    voteTargetId: string | null;
    attackTargetId: string | null;
    divineTargetId: string | null;
    guardTargetId: string | null;
  } | null;
  players: { id: string; username: string; status: string; isMe: boolean }[];
  divineResults: {
    day: number;
    targetId: string;
    targetName: string;
    isWerewolf: boolean;
  }[];
  psychicResults: {
    day: number;
    targetId: string;
    targetName: string;
    isWerewolf: boolean;
  }[];
}

export function ActionPanel({
  villageId,
  myRole,
  myStatus,
  myRecord,
  players,
  divineResults,
  psychicResults,
}: ActionPanelProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { selectedTarget, setSelectedTarget } = useGameStore();

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: trpc.game.state.queryKey(),
    });
  };

  const voteMutation = useMutation(
    trpc.game.vote.mutationOptions({
      onSuccess: () => {
        toast.success("投票しました");
        setSelectedTarget(null);
        invalidate();
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  const attackMutation = useMutation(
    trpc.game.attack.mutationOptions({
      onSuccess: () => {
        toast.success("襲撃先を設定しました");
        setSelectedTarget(null);
        invalidate();
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  const divineMutation = useMutation(
    trpc.game.divine.mutationOptions({
      onSuccess: () => {
        toast.success("占い先を設定しました");
        setSelectedTarget(null);
        invalidate();
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  const guardMutation = useMutation(
    trpc.game.guard.mutationOptions({
      onSuccess: () => {
        toast.success("守護先を設定しました");
        setSelectedTarget(null);
        invalidate();
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  if (myStatus !== "ALIVE") {
    return (
      <div className="border-t px-4 py-3 text-sm text-muted-foreground">
        あなたは死亡しています。霊界ルームでチャットできます。
      </div>
    );
  }

  const targetName =
    players.find((p) => p.id === selectedTarget)?.username ?? null;

  const getTargetName = (id: string | null) =>
    id ? (players.find((p) => p.id === id)?.username ?? "???") : null;

  return (
    <div className="space-y-3 border-t px-4 py-3">
      {/* Current selection */}
      {selectedTarget && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">選択中:</span>
          <span className="font-semibold">{targetName}</span>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        {/* Vote - all alive players */}
        <ActionButton
          label="投票"
          currentTargetName={getTargetName(myRecord?.voteTargetId ?? null)}
          disabled={!selectedTarget}
          isPending={voteMutation.isPending}
          onClick={() =>
            voteMutation.mutate({
              villageId,
              targetPlayerId: selectedTarget!,
            })
          }
        />

        {/* Attack - werewolves only */}
        {myRole === "WEREWOLF" && (
          <ActionButton
            label="襲撃"
            currentTargetName={getTargetName(
              myRecord?.attackTargetId ?? null,
            )}
            disabled={!selectedTarget}
            isPending={attackMutation.isPending}
            onClick={() =>
              attackMutation.mutate({
                villageId,
                targetPlayerId: selectedTarget!,
              })
            }
          />
        )}

        {/* Divine - fortune teller only */}
        {myRole === "FORTUNE_TELLER" && (
          <ActionButton
            label="占い"
            currentTargetName={getTargetName(
              myRecord?.divineTargetId ?? null,
            )}
            disabled={!selectedTarget}
            isPending={divineMutation.isPending}
            onClick={() =>
              divineMutation.mutate({
                villageId,
                targetPlayerId: selectedTarget!,
              })
            }
          />
        )}

        {/* Guard - bodyguard only */}
        {myRole === "BODYGUARD" && (
          <ActionButton
            label="守護"
            currentTargetName={getTargetName(
              myRecord?.guardTargetId ?? null,
            )}
            disabled={!selectedTarget}
            isPending={guardMutation.isPending}
            onClick={() =>
              guardMutation.mutate({
                villageId,
                targetPlayerId: selectedTarget!,
              })
            }
          />
        )}
      </div>

      {/* Role-specific info */}
      {myRole === "FORTUNE_TELLER" && divineResults.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground">
            占い結果
          </p>
          {divineResults.map((r) => (
            <div key={r.day} className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Day {r.day}:</span>
              <span>{r.targetName}</span>
              <Badge
                variant={r.isWerewolf ? "destructive" : "secondary"}
                className="text-[10px]"
              >
                {r.isWerewolf ? "人狼" : "人間"}
              </Badge>
            </div>
          ))}
        </div>
      )}

      {myRole === "PSYCHIC" && psychicResults.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground">
            霊媒結果
          </p>
          {psychicResults.map((r) => (
            <div key={r.day} className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Day {r.day}:</span>
              <span>{r.targetName}</span>
              <Badge
                variant={r.isWerewolf ? "destructive" : "secondary"}
                className="text-[10px]"
              >
                {r.isWerewolf ? "人狼" : "人間"}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ActionButton({
  label,
  currentTargetName,
  disabled,
  isPending,
  onClick,
}: {
  label: string;
  currentTargetName: string | null;
  disabled: boolean;
  isPending: boolean;
  onClick: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Button
        size="sm"
        variant="outline"
        disabled={disabled || isPending}
        onClick={onClick}
      >
        {isPending ? `${label}中...` : label}
      </Button>
      {currentTargetName && (
        <span className="text-xs text-muted-foreground">
          ({currentTargetName})
        </span>
      )}
    </div>
  );
}
