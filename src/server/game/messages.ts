import { ROLE_DISPLAY_NAMES } from "@/types/game";

interface VoteEntry {
  voterName: string;
  targetName: string;
}

export function buildNoonMessage(params: {
  votes: VoteEntry[];
  lynchTargetName: string | null;
  showVoteTarget: boolean;
}): string {
  const lines: string[] = ["--- 昼の投票結果 ---"];

  if (params.showVoteTarget && params.votes.length > 0) {
    for (const v of params.votes) {
      lines.push(`${v.voterName} → ${v.targetName}`);
    }
    lines.push("");
  }

  if (params.lynchTargetName) {
    lines.push(`${params.lynchTargetName} が処刑されました。`);
  } else {
    lines.push("同数票のため、処刑は行われませんでした。");
  }

  return lines.join("\n");
}

export function buildNightMessage(params: {
  day: number;
  killedName: string | null;
}): string {
  if (params.day === 1) {
    return "--- 夜のできごと ---\n初日のため、人狼の襲撃はありませんでした。";
  }

  if (params.killedName) {
    return `--- 夜のできごと ---\n${params.killedName} が無残な姿で発見されました。`;
  }

  return "--- 夜のできごと ---\n昨晩の犠牲者はいませんでした。";
}

export function buildMorningMessage(params: {
  day: number;
  survivors: string[];
}): string {
  const lines: string[] = [`--- ${params.day}日目の朝 ---`];
  lines.push(`生存者（${params.survivors.length}人）: ${params.survivors.join("、")}`);
  return lines.join("\n");
}

export function buildEndMessage(params: {
  winner: "HUMANS" | "WEREWOLVES";
}): string {
  const winnerName = params.winner === "HUMANS" ? "人間陣営" : "人狼陣営";
  return `=== ゲーム終了 ===\n${winnerName}の勝利！`;
}

export function buildRevealMessage(params: {
  players: { username: string; role: string }[];
}): string {
  const lines: string[] = ["--- 役職公開 ---"];
  for (const p of params.players) {
    lines.push(`${p.username}: ${ROLE_DISPLAY_NAMES[p.role] ?? p.role}`);
  }
  return lines.join("\n");
}
