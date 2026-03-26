"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/react";
import { ROLE_DISPLAY_NAMES } from "@/types/game";
import { Badge } from "@/components/ui/badge";

interface ResultsPanelProps {
  villageId: string;
}

export function ResultsPanel({ villageId }: ResultsPanelProps) {
  const trpc = useTRPC();
  const { data, isLoading } = useQuery(
    trpc.game.results.queryOptions({ villageId }),
  );

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">読み込み中...</p>
      </div>
    );
  }

  if (!data || data.results.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">結果データがありません</p>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 overflow-y-auto p-4">
      <h2 className="text-sm font-bold">結果一覧</h2>
      {data.results.map((result) => {
        const dayVotes = data.voteDetails.filter((v) => v.day === result.day);
        return (
          <DayResult
            key={result.day}
            result={result}
            votes={dayVotes}
            showVoteTarget={data.showVoteTarget}
          />
        );
      })}
    </div>
  );
}

interface DayResultProps {
  result: {
    day: number;
    hasNightPhase: boolean;
    votedPlayer: { username: string; role: string } | null;
    attackedPlayer: { username: string; role: string } | null;
    divinedPlayer: { username: string; isWerewolf: boolean } | null;
    guardedPlayer: { username: string } | null;
  };
  votes: { voterName: string; targetName: string }[];
  showVoteTarget: boolean;
}

function DayResult({ result, votes, showVoteTarget }: DayResultProps) {
  // 得票数を集計
  const voteCounts = new Map<string, number>();
  for (const v of votes) {
    voteCounts.set(v.targetName, (voteCounts.get(v.targetName) ?? 0) + 1);
  }
  const sortedCounts = [...voteCounts.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div className="rounded-md border p-3 text-sm">
      <p className="mb-2 font-semibold">{result.day}日目</p>
      <div className="space-y-1.5 text-muted-foreground">
        {/* 処刑 */}
        {result.votedPlayer && (
          <div>
            <span className="font-medium text-foreground">処刑: </span>
            {result.votedPlayer.username}
            <Badge variant="outline" className="ml-1.5 text-[10px] px-1 py-0">
              {ROLE_DISPLAY_NAMES[result.votedPlayer.role] ?? result.votedPlayer.role}
            </Badge>
          </div>
        )}

        {/* 投票内訳 */}
        {votes.length > 0 && (
          <div className="ml-4 space-y-0.5 text-xs">
            {showVoteTarget
              ? votes.map((v, i) => (
                  <div key={i}>
                    {v.voterName} → {v.targetName}
                  </div>
                ))
              : sortedCounts.map(([name, count]) => (
                  <div key={name}>
                    {name}: {count}票
                  </div>
                ))}
          </div>
        )}

        {/* 夜フェーズ結果 */}
        {result.hasNightPhase && (
          <>
            {/* 襲撃 */}
            {result.attackedPlayer ? (
              <div>
                <span className="font-medium text-foreground">襲撃: </span>
                {result.attackedPlayer.username}
                <Badge variant="outline" className="ml-1.5 text-[10px] px-1 py-0">
                  {ROLE_DISPLAY_NAMES[result.attackedPlayer.role] ?? result.attackedPlayer.role}
                </Badge>
              </div>
            ) : (
              <div>
                <span className="font-medium text-foreground">襲撃: </span>
                犠牲者なし
              </div>
            )}

            {/* 占い */}
            {result.divinedPlayer && (
              <div>
                <span className="font-medium text-foreground">占い: </span>
                {result.divinedPlayer.username} →{" "}
                {result.divinedPlayer.isWerewolf ? "人狼" : "人狼ではない"}
              </div>
            )}

            {/* 護衛 */}
            {result.guardedPlayer && (
              <div>
                <span className="font-medium text-foreground">護衛: </span>
                {result.guardedPlayer.username}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
