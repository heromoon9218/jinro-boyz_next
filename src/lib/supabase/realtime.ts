"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

/**
 * Subscribe to new posts in a room via Postgres Changes.
 * Returns the channel for cleanup.
 */
export function subscribeToRoomPosts(
  roomId: string,
  onNewPost: () => void,
): RealtimeChannel {
  const supabase = createClient();

  const channel = supabase
    .channel(`room:${roomId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "posts",
        filter: `room_id=eq.${roomId}`,
      },
      () => {
        onNewPost();
      },
    )
    .subscribe();

  return channel;
}

/**
 * Subscribe to village game update broadcasts.
 * Returns the channel for cleanup.
 */
export function subscribeToVillageUpdates(
  villageId: string,
  onUpdate: () => void,
): RealtimeChannel {
  const supabase = createClient();

  const channel = supabase
    .channel(`village:${villageId}`)
    .on("broadcast", { event: "game_updated" }, () => {
      onUpdate();
    })
    .subscribe();

  return channel;
}
