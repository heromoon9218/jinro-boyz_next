import { createTRPCRouter } from "@/server/trpc/init";
import { gameRouter } from "./game";
import { userRouter } from "./user";
import { villageRouter } from "./village";

export const appRouter = createTRPCRouter({
  game: gameRouter,
  user: userRouter,
  village: villageRouter,
});

export type AppRouter = typeof appRouter;
