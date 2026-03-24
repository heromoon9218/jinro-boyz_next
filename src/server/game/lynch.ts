/**
 * Determine which player gets lynched based on vote records.
 *
 * Rules:
 * - Most votes → executed
 * - Tie → random pick among tied players (execution always happens)
 * - No votes → random pick from alivePlayerIds
 */
export function determineLynchTarget(
  votes: { voterId: string; targetId: string }[],
  alivePlayerIds: string[],
): string {
  if (votes.length === 0) {
    return pickRandom(alivePlayerIds);
  }

  const voteCounts = new Map<string, number>();
  for (const vote of votes) {
    voteCounts.set(vote.targetId, (voteCounts.get(vote.targetId) ?? 0) + 1);
  }

  const maxVotes = Math.max(...voteCounts.values());
  const topTargets = [...voteCounts.entries()]
    .filter(([, count]) => count === maxVotes)
    .map(([id]) => id);

  return topTargets.length === 1 ? topTargets[0] : pickRandom(topTargets);
}

function pickRandom(arr: string[]): string {
  if (arr.length === 0) throw new Error("pickRandom called with empty array");
  return arr[Math.floor(Math.random() * arr.length)];
}
