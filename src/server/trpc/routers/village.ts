import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
} from "@/server/trpc/init";

export const villageRouter = createTRPCRouter({
  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.village.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { username: true } },
        _count: { select: { players: true } },
      },
    });
  }),

  byId: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.village.findUnique({
        where: { id: input.id },
        include: {
          user: { select: { username: true } },
          players: {
            include: { user: { select: { username: true } } },
          },
        },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(50),
        playerNum: z.number().int().min(5).max(16),
        discussionTime: z.number().int().min(60).max(600),
        accessPassword: z.string().optional(),
        showVoteTarget: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { authId: ctx.user.id },
      });

      if (!user) {
        throw new Error("User not found");
      }

      return ctx.db.village.create({
        data: {
          ...input,
          userId: user.id,
        },
      });
    }),
});
