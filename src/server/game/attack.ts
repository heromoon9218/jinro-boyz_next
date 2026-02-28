/**
 * Resolve the night attack phase.
 * Returns the ID of the killed player, or null if the attack was guarded.
 */
export function resolveAttack(params: {
  attackTargetId: string | null;
  guardTargetId: string | null;
}): string | null {
  if (!params.attackTargetId) return null;

  // If the bodyguard protected the attack target, no one dies
  if (params.guardTargetId === params.attackTargetId) return null;

  return params.attackTargetId;
}
