"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

/** Singleton browser client shared across all realtime subscriptions. */
let browserClient: ReturnType<typeof createClient> | null = null;

function getBrowserClient() {
  if (!browserClient) {
    browserClient = createClient();
  }
  return browserClient;
}

interface Subscription {
  channel: RealtimeChannel;
  /** The client that owns the channel (for removeChannel cleanup). */
  client: ReturnType<typeof createClient>;
}

/**
 * Subscribe to new posts in a room via Postgres Changes.
 * Returns the channel for cleanup via `supabase.removeChannel(channel)`.
 */
export function subscribeToRoomPosts(
  roomId: string,
  onNewPost: () => void,
): Subscription {
  const supabase = getBrowserClient();

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

  return { channel, client: supabase };
}

/**
 * Subscribe to village game update broadcasts.
 * Returns the channel and client for cleanup.
 */
export function subscribeToVillageUpdates(
  villageId: string,
  onUpdate: () => void,
): Subscription {
  const supabase = getBrowserClient();

  const channel = supabase
    .channel(`village:${villageId}`)
    .on("broadcast", { event: "game_updated" }, () => {
      onUpdate();
    })
    .subscribe();

  return { channel, client: supabase };
}
