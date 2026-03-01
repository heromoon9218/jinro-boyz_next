import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc/init";

export const userRouter = createTRPCRouter({
  updateProfile: protectedProcedure
    .input(z.object({ comment: z.string().max(500).nullable() }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUniqueOrThrow({
        where: { authId: ctx.user.id },
      });
      return ctx.db.profile.update({
        where: { userId: user.id },
        data: { comment: input.comment },
      });
    }),
});
