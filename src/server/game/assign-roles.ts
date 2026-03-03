import { Role } from "@/generated/prisma";
import { getRoleComposition } from "./roles";

/**
 * Shuffle an array using Fisher-Yates algorithm.
 */
function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Assign roles to players. Returns a map of playerId -> Role.
 */
export function assignRoles(playerIds: string[]): Map<string, Role> {
  const roles = getRoleComposition(playerIds.length);
  const shuffledRoles = shuffle(roles);

  const assignments = new Map<string, Role>();
  playerIds.forEach((id, index) => {
    assignments.set(id, shuffledRoles[index]);
  });

  return assignments;
}
