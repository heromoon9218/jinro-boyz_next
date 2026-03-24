"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useState } from "react";
import type { Role, PlayerStatus } from "@/generated/prisma";

interface Player {
  id: string;
  username: string;
  status: PlayerStatus;
  role?: string;
}

interface CurrentRecord {
  id: string;
  voteTargetId: string | null;
  attackTargetId: string | null;
  divineTargetId: string | null;
  guardTargetId: string | null;
}

interface SkillPanelProps {
  villageId: string;
  currentPlayerId: string;
  currentRole: Role;
  players: Player[];
  currentRecord: CurrentRecord | null;
  day: number;
}

export function SkillPanel({
  villageId,
  currentPlayerId,
  currentRole,
  players,
  currentRecord,
  day,
}: SkillPanelProps) {
  const alivePlayers = players.filter(
    (p) => p.status === "ALIVE" && p.id !== currentPlayerId,
  );
  const aliveNonWolves = alivePlayers.filter(
    (p) => p.role !== "WEREWOLF",
  );

  return (
    <div className="space-y-4 border-t p-4">
      <h3 className="text-sm font-semibold">アクション</h3>

      {/* Vote - all alive players can vote */}
      <ActionRow
        label="投票先"
        villageId={villageId}
        action="vote"
        targets={alivePlayers}
        currentTargetId={currentRecord?.voteTargetId ?? null}
      />

      {/* Attack - werewolf only */}
      {currentRole === "WEREWOLF" && (
        <ActionRow
          label="襲撃先"
          villageId={villageId}
          action="attack"
          targets={aliveNonWolves}
          currentTargetId={currentRecord?.attackTargetId ?? null}
        />
      )}

      {/* Divine - fortune teller only */}
      {currentRole === "FORTUNE_TELLER" && (
        <>
          <ActionRow
            label="占い先"
            villageId={villageId}
            action="divine"
            targets={alivePlayers}
            currentTargetId={currentRecord?.divineTargetId ?? null}
          />
          {day > 1 && <DivineResults villageId={villageId} />}
        </>
      )}

      {/* Psychic results */}
      {currentRole === "PSYCHIC" && day > 1 && (
        <PsychicResults villageId={villageId} />
      )}

      {/* Guard - bodyguard only */}
      {currentRole === "BODYGUARD" && (
        <ActionRow
          label="護衛先"
          villageId={villageId}
          action="guard"
          targets={alivePlayers}
          currentTargetId={currentRecord?.guardTargetId ?? null}
        />
      )}
    </div>
  );
}

// ── Action Row ──

type ActionType = "vote" | "attack" | "divine" | "guard";

function ActionRow({
  label,
  villageId,
  action,
  targets,
  currentTargetId,
}: {
  label: string;
  villageId: string;
  action: ActionType;
  targets: Player[];
  currentTargetId: string | null;
}) {
  const [selected, setSelected] = useState<string>("");
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const mutation = useMutation(
    trpc.game[action].mutationOptions({
      onSuccess: () => {
        toast.success(`${label}をセットしました`);
        setSelected("");
        queryClient.invalidateQueries({
          queryKey: trpc.game.state.queryKey({ villageId }),
        });
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const currentTargetName = currentTargetId
    ? targets.find((t) => t.id === currentTargetId)?.username
    : null;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium w-16 shrink-0">{label}</span>
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger className="flex-1 h-8 text-sm">
            <SelectValue placeholder="選択..." />
          </SelectTrigger>
          <SelectContent>
            {targets.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.username}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant="secondary"
          disabled={!selected || mutation.isPending}
          onClick={() =>
            mutation.mutate({ villageId, targetPlayerId: selected })
          }
        >
          セット
        </Button>
      </div>
      {currentTargetName && (
        <p className="text-xs text-muted-foreground pl-[4.5rem]">
          現在: {currentTargetName}
        </p>
      )}
    </div>
  );
}

// ── Divine Results ──

function DivineResults({ villageId }: { villageId: string }) {
  const trpc = useTRPC();
  const [show, setShow] = useState(false);

  const { data } = useQuery({
    ...trpc.game.divineResults.queryOptions({ villageId }),
    enabled: show,
  });

  return (
    <div>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setShow(!show)}
      >
        {show ? "占い結果を閉じる" : "占い結果を見る"}
      </Button>
      {show && data && (
        <div className="mt-2 space-y-1">
          {data.length === 0 && (
            <p className="text-xs text-muted-foreground">まだ結果がありません</p>
          )}
          {data.map((r) => (
            <div key={r.day} className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">{r.day}日目:</span>
              <span>{r.targetUsername}</span>
              <Badge
                variant={r.isWerewolf ? "destructive" : "default"}
                className="text-[10px] px-1 py-0"
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

// ── Psychic Results ──

function PsychicResults({ villageId }: { villageId: string }) {
  const trpc = useTRPC();
  const [show, setShow] = useState(false);

  const { data } = useQuery({
    ...trpc.game.psychicResults.queryOptions({ villageId }),
    enabled: show,
  });

  return (
    <div>
      <h4 className="text-sm font-medium mb-1">霊媒結果</h4>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setShow(!show)}
      >
        {show ? "霊媒結果を閉じる" : "霊媒結果を見る"}
      </Button>
      {show && data && (
        <div className="mt-2 space-y-1">
          {data.length === 0 && (
            <p className="text-xs text-muted-foreground">まだ結果がありません</p>
          )}
          {data.map((r) => (
            <div key={r.day} className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">{r.day}日目:</span>
              <span>{r.targetUsername}</span>
              <Badge
                variant={r.isWerewolf ? "destructive" : "default"}
                className="text-[10px] px-1 py-0"
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
