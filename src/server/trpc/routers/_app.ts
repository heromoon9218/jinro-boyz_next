import { createTRPCRouter } from "@/server/trpc/init";
import { userRouter } from "./user";
import { villageRouter } from "./village";
import { gameRouter } from "./game";

export const appRouter = createTRPCRouter({
  user: userRouter,
  village: villageRouter,
  game: gameRouter,
});

export type AppRouter = typeof appRouter;
