/**
 * Determine which player gets lynched based on vote records.
 * If there are votes, the player with the most votes is lynched.
 * On a tie, one of the top-voted players is chosen randomly.
 * If no votes were cast, a random player from aliveFallback is lynched.
 */
export function determineLynchTarget(
  votes: { voterId: string; targetId: string }[],
  aliveFallbackIds: string[] = [],
): string | null {
  if (votes.length === 0) {
    // No votes cast — choose randomly from alive players
    if (aliveFallbackIds.length === 0) return null;
    return aliveFallbackIds[Math.floor(Math.random() * aliveFallbackIds.length)];
  }

  const voteCounts = new Map<string, number>();
  for (const vote of votes) {
    voteCounts.set(vote.targetId, (voteCounts.get(vote.targetId) ?? 0) + 1);
  }

  const maxVotes = Math.max(...voteCounts.values());
  const topTargets = [...voteCounts.entries()]
    .filter(([, count]) => count === maxVotes)
    .map(([id]) => id);

  // Tie — choose randomly among the top-voted players
  return topTargets[Math.floor(Math.random() * topTargets.length)];
}
