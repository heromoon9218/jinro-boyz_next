import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Broadcast a game state update to all clients subscribed to the village channel.
 * Uses Supabase Realtime Broadcast via the admin (service role) client.
 */
export async function broadcastGameUpdate(villageId: string): Promise<void> {
  const supabase = createAdminClient();
  const channel = supabase.channel(`village:${villageId}`);

  await channel.send({
    type: "broadcast",
    event: "game_updated",
    payload: { villageId, timestamp: Date.now() },
  });

  await supabase.removeChannel(channel);
}
