import { createTRPCRouter } from "@/server/trpc/init";
import { userRouter } from "./user";
import { villageRouter } from "./village";

export const appRouter = createTRPCRouter({
  user: userRouter,
  village: villageRouter,
});

export type AppRouter = typeof appRouter;
