"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/react";
import { createClient } from "@/lib/supabase/client";

export function useRealtimeVillage(villageId: string) {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`village:${villageId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "villages",
          filter: `id=eq.${villageId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: trpc.game.state.queryKey({ villageId }),
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [villageId, queryClient, trpc]);
}
