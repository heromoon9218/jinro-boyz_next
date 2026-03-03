import { Role } from "@/generated/prisma";
import { ROLE_COMPOSITIONS } from "@/types/game";

/**
 * Get the role composition for a given player count.
 * Returns an array of Role enums.
 */
export function getRoleComposition(playerCount: number): Role[] {
  const composition = ROLE_COMPOSITIONS[playerCount];
  if (!composition) {
    throw new Error(
      `No role composition defined for ${playerCount} players (supported: 5-16)`,
    );
  }
  return composition.map((r) => Role[r as keyof typeof Role]);
}
