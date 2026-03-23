import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Broadcast a game state update to all clients subscribed to the village channel.
 * Uses Supabase Realtime Broadcast REST (`httpSend`) so delivery does not depend on
 * a prior WebSocket `subscribe()` (required for `channel.send()` on the socket path).
 * Failures reject with `Error` so callers can observe errors (unlike `send()` resolving to `"error"`).
 */
export async function broadcastGameUpdate(villageId: string): Promise<void> {
  const supabase = createAdminClient();
  const channel = supabase.channel(`village:${villageId}`);

  try {
    await channel.httpSend("game_updated", {
      villageId,
      timestamp: Date.now(),
    });
  } finally {
    await supabase.removeChannel(channel);
  }
}
