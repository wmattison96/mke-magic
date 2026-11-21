import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { StatsPlayer } from "@/lib/stats/dashboard";

/** Reads only the safe member projection; private auth mappings are not queried. */
export async function getPublicPlayers(): Promise<StatsPlayer[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("readable_players")
    .select("id,display_name,moxfield_url")
    .order("display_name", { ascending: true });
  if (error) throw new Error("Unable to load the registered playgroup members.");
  return (data ?? []).map((player) => ({ id: player.id, name: player.display_name, moxfieldUrl: player.moxfield_url }));
}
