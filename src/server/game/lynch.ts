/**
 * Determine which player gets lynched based on vote records.
 * Returns the player ID with the most votes, or null on a tie.
 */
export function determineLynchTarget(
  votes: { voterId: string; targetId: string }[],
): string | null {
  if (votes.length === 0) return null;

  const voteCounts = new Map<string, number>();
  for (const vote of votes) {
    voteCounts.set(vote.targetId, (voteCounts.get(vote.targetId) ?? 0) + 1);
  }

  const maxVotes = Math.max(...voteCounts.values());
  const topTargets = [...voteCounts.entries()]
    .filter(([, count]) => count === maxVotes)
    .map(([id]) => id);

  // Tie = no execution
  if (topTargets.length > 1) return null;

  return topTargets[0];
}
