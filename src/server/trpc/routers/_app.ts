import { createTRPCRouter } from "@/server/trpc/init";
import { villageRouter } from "./village";

export const appRouter = createTRPCRouter({
  village: villageRouter,
});

export type AppRouter = typeof appRouter;
