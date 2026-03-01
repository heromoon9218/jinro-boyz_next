import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc/init";

export const userRouter = createTRPCRouter({
  updateProfile: protectedProcedure
    .input(z.object({ comment: z.string().max(500).nullable() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.profile.update({
        where: { userId: ctx.dbUser.id },
        data: { comment: input.comment },
      });
    }),
});
