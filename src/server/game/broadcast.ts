import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Module-level singleton to avoid leaking a new client on every broadcast call.
 * In serverless environments (Vercel) this is per-worker-instance, not globally shared.
 */
let adminClient: ReturnType<typeof createAdminClient> | null = null;

function getAdminClient() {
  if (!adminClient) {
    adminClient = createAdminClient();
  }
  return adminClient;
}

/**
 * Broadcast a game state update to all clients subscribed to the village channel.
 * Uses Supabase Realtime Broadcast REST (`httpSend`) so delivery does not depend on
 * a prior WebSocket `subscribe()` (required for `channel.send()` on the socket path).
 * Failures reject with `Error` so callers can observe errors (unlike `send()` resolving to `"error"`).
 */
export async function broadcastGameUpdate(villageId: string): Promise<void> {
  const supabase = getAdminClient();
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
