"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/react";
import { subscribeToVillageUpdates } from "@/lib/supabase/realtime";
import { createClient } from "@/lib/supabase/client";

/**
 * Hook that subscribes to real-time game state updates for a village.
 * Invalidates game.state and village.byId queries on game_updated events.
 */
export function useGameRealtime(villageId: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = subscribeToVillageUpdates(villageId, () => {
      queryClient.invalidateQueries({
        queryKey: trpc.game.state.queryKey(),
      });
      queryClient.invalidateQueries({
        queryKey: [["village"]],
      });
      queryClient.invalidateQueries({
        queryKey: trpc.game.messages.queryKey(),
      });
    });

    return () => {
      const supabase = createClient();
      supabase.removeChannel(channel);
    };
  }, [villageId, queryClient, trpc]);
}
