import { Role, Winner } from "@/generated/prisma";

interface LivingPlayer {
  id: string;
  role: Role;
}

/**
 * Judge if the game has ended.
 * - Humans win when all werewolves are eliminated.
 * - Werewolves win when living wolves >= living humans.
 * Returns the Winner or null if the game continues.
 */
export function judgeEnd(livingPlayers: LivingPlayer[]): Winner | null {
  const wolves = livingPlayers.filter((p) => p.role === Role.WEREWOLF);
  const humans = livingPlayers.filter((p) => p.role !== Role.WEREWOLF);

  if (wolves.length === 0) {
    return Winner.HUMANS;
  }

  if (wolves.length >= humans.length) {
    return Winner.WEREWOLVES;
  }

  return null;
}
