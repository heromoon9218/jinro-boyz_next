"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/react";
import { ROLE_DISPLAY_NAMES } from "@/types/game";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function winRate(won: number, played: number): string {
  if (played === 0) return "-";
  return `${((won / played) * 100).toFixed(2)}%`;
}

export function GameRecord() {
  const trpc = useTRPC();
  const { data, isLoading, isError } = useQuery(trpc.user.stats.queryOptions());

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground">戦績を読み込み中...</p>
    );
  }

  if (isError) {
    return (
      <p className="text-sm text-destructive">戦績の読み込みに失敗しました</p>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-2">
      <h2 className="text-lg font-semibold">戦績</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>役職</TableHead>
            <TableHead className="text-right">勝利数</TableHead>
            <TableHead className="text-right">対戦数</TableHead>
            <TableHead className="text-right">勝率</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.roleStats.map((stat) => (
            <TableRow key={stat.role}>
              <TableCell>{ROLE_DISPLAY_NAMES[stat.role] ?? stat.role}</TableCell>
              <TableCell className="text-right">{stat.won} 回</TableCell>
              <TableCell className="text-right">{stat.played} 回</TableCell>
              <TableCell className="text-right">
                {winRate(stat.won, stat.played)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell className="font-semibold">合計</TableCell>
            <TableCell className="text-right">{data.totalWon} 回</TableCell>
            <TableCell className="text-right">{data.totalPlayed} 回</TableCell>
            <TableCell className="text-right">
              {winRate(data.totalWon, data.totalPlayed)}
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}
