"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/react";
import { subscribeToRoomPosts } from "@/lib/supabase/realtime";

/**
 * Hook that subscribes to real-time post updates for a room.
 * Invalidates the messages query when a new post is inserted.
 */
export function useRealtimePosts(roomId: string | null) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!roomId) return;

    const { client, channel } = subscribeToRoomPosts(roomId, () => {
      queryClient.invalidateQueries({
        queryKey: trpc.game.messages.queryKey(),
      });
    });

    return () => {
      client.removeChannel(channel);
    };
  }, [roomId, queryClient, trpc]);
}
