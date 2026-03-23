"use client";

import type { SupabaseClient, RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

interface Subscription {
  supabase: SupabaseClient;
  channel: RealtimeChannel;
}

/**
 * Subscribe to new posts in a room via Postgres Changes.
 * Returns the supabase client and channel for cleanup.
 */
export function subscribeToRoomPosts(
  roomId: string,
  onNewPost: () => void,
): Subscription {
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

  return { supabase, channel };
}

/**
 * Subscribe to village game update broadcasts.
 * Returns the supabase client and channel for cleanup.
 */
export function subscribeToVillageUpdates(
  villageId: string,
  onUpdate: () => void,
): Subscription {
  const supabase = createClient();

  const channel = supabase
    .channel(`village:${villageId}`)
    .on("broadcast", { event: "game_updated" }, () => {
      onUpdate();
    })
    .subscribe();

  return { supabase, channel };
}
