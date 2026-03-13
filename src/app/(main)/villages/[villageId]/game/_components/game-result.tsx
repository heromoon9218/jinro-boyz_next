"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ROLE_DISPLAY_NAMES } from "@/types/game";

interface GameResultProps {
  villageId: string;
}

export function GameResult({ villageId }: GameResultProps) {
  const trpc = useTRPC();

  const { data, isLoading } = useQuery(
    trpc.game.results.queryOptions({ villageId }),
  );

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-32 animate-pulse rounded-xl border bg-muted" />
      </div>
    );
  }

  if (!data) {
    return <p className="p-4 text-muted-foreground">結果を取得できません</p>;
  }

  const winnerLabel =
    data.winner === "HUMANS" ? "人間陣営の勝利" : "人狼陣営の勝利";

  return (
    <div className="space-y-6 p-4">
      <div className="text-center">
        <h2 className="text-2xl font-bold">{winnerLabel}</h2>
        <p className="text-sm text-muted-foreground">{data.villageName}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>役職一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.players.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between text-sm"
              >
                <span>{p.username}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {ROLE_DISPLAY_NAMES[p.role] ?? p.role}
                  </Badge>
                  <Badge
                    variant={p.status === "ALIVE" ? "secondary" : "destructive"}
                    className="text-[10px]"
                  >
                    {p.status === "ALIVE" ? "生存" : "死亡"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>日ごとの記録</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.results.map((r) => (
              <div key={r.day}>
                <p className="text-sm font-semibold">Day {r.day}</p>
                <div className="mt-1 space-y-1 text-sm text-muted-foreground">
                  <p>
                    処刑: {r.votedPlayer?.username ?? "なし"}
                  </p>
                  <p>
                    襲撃: {r.attackedPlayer?.username ?? "なし"}
                  </p>
                  {r.divinedPlayer && (
                    <p>占い: {r.divinedPlayer.username}</p>
                  )}
                  {r.guardedPlayer && (
                    <p>守護: {r.guardedPlayer.username}</p>
                  )}
                </div>
                {r.day < data.results.length && <Separator className="mt-3" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
