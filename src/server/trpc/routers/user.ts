import { z } from "zod";
import { Role } from "@/generated/prisma";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc/init";
import { ROLE_TEAMS } from "@/types/game";

export const userRouter = createTRPCRouter({
  updateProfile: protectedProcedure
    .input(z.object({ comment: z.string().max(500).nullable() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.profile.update({
        where: { userId: ctx.dbUser.id },
        data: { comment: input.comment },
      });
    }),

  stats: protectedProcedure.query(async ({ ctx }) => {
    const players = await ctx.db.player.findMany({
      where: {
        userId: ctx.dbUser.id,
        village: { status: "ENDED" },
      },
      include: {
        village: { select: { winner: true } },
      },
    });

    const roleStats = Object.values(Role).map((role) => {
      const rolePlayers = players.filter((p) => p.role === role);
      const team = ROLE_TEAMS[role];
      const winCondition = team === "HUMAN" ? "HUMANS" : "WEREWOLVES";
      const won = rolePlayers.filter(
        (p) => p.village.winner === winCondition,
      ).length;
      return { role, played: rolePlayers.length, won };
    });

    const totalPlayed = players.length;
    const totalWon = players.filter((p) => {
      const team = ROLE_TEAMS[p.role];
      const winCondition = team === "HUMAN" ? "HUMANS" : "WEREWOLVES";
      return p.village.winner === winCondition;
    }).length;

    return { roleStats, totalPlayed, totalWon };
  }),
});
