import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { db } from "@/server/db";
import { createClient } from "@/lib/supabase/server";

export const createTRPCContext = async (opts: { headers: Headers }) => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return {
    db,
    supabase,
    user,
    ...opts,
  };
};

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
});

export const createCallerFactory = t.createCallerFactory;
export const createTRPCRouter = t.router;

// Public procedure — no auth required
export const publicProcedure = t.procedure;

// Protected procedure — requires authenticated user + resolves DB user
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  const dbUser = await ctx.db.user.findUnique({
    where: { authId: ctx.user.id },
  });

  if (!dbUser) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "ユーザーが見つかりません",
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      dbUser,
    },
  });
});
