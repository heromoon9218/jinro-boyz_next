import { ROLE_DISPLAY_NAMES } from "@/types/game";

interface VoteInfo {
  voterName: string;
  targetName: string;
}

interface VoteCount {
  playerName: string;
  count: number;
}

export function startMessage(wolfCount: number): string {
  return [
    `ゲームが開始されました。`,
    `この村には、人狼が${wolfCount}人潜んでいるようだ。`,
    `村人たちよ、話し合いで人狼を見つけ出せ。`,
  ].join("\n");
}

export function voteResultMessage(
  votes: VoteInfo[],
  executedName: string,
  showVoteTarget: boolean,
): string {
  const lines: string[] = [];

  if (showVoteTarget) {
    for (const v of votes) {
      lines.push(`${v.voterName} は ${v.targetName} に投票しました。`);
    }
  } else {
    const counts = new Map<string, number>();
    for (const v of votes) {
      counts.set(v.targetName, (counts.get(v.targetName) ?? 0) + 1);
    }
    const sorted: VoteCount[] = [...counts.entries()]
      .map(([playerName, count]) => ({ playerName, count }))
      .sort((a, b) => b.count - a.count);
    for (const { playerName, count } of sorted) {
      lines.push(`${playerName} は ${count}票でした。`);
    }
  }

  lines.push("");
  lines.push(
    `投票の結果、${executedName} は村人たちの手によって処刑されました。`,
  );

  return lines.join("\n");
}

export function noVoteMessage(executedName: string): string {
  return [
    `投票がありませんでした。ランダムで処刑対象が選ばれます。`,
    `${executedName} は村人たちの手によって処刑されました。`,
  ].join("\n");
}

export function morningMessage(
  day: number,
  killedName: string | null,
): string {
  if (killedName) {
    return [
      `${day}日目の朝が来ました。`,
      `${killedName} が変わり果てた姿で見つかりました。`,
    ].join("\n");
  }
  return [
    `${day}日目の朝が来ました。`,
    `昨晩は誰も犠牲にならなかったようだ。`,
  ].join("\n");
}

export function gameEndMessage(
  winnerTeam: "HUMANS" | "WEREWOLVES",
  players: { username: string; role: string }[],
): string {
  const winnerLabel = winnerTeam === "HUMANS" ? "村人陣営" : "人狼陣営";
  const lines = [`ゲームが終了しました。${winnerLabel}の勝利です！`, ""];
  lines.push("【配役】");
  for (const p of players) {
    lines.push(`${p.username}: ${ROLE_DISPLAY_NAMES[p.role] ?? p.role}`);
  }
  return lines.join("\n");
}

export function wolfAttackSetMessage(
  wolfName: string,
  targetName: string,
): string {
  return `${wolfName} が ${targetName} を襲撃対象にセットしました。`;
}
