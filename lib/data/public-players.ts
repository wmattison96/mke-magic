import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { PUBLIC_PLAYERS_TAG } from "@/lib/data/cache-tags";
import { createPublicClient } from "@/lib/supabase/public";
import type { StatsPlayer } from "@/lib/stats/dashboard";

/** Reads only the safe member projection; private auth mappings are not queried. */
export async function getPublicPlayers(): Promise<StatsPlayer[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(PUBLIC_PLAYERS_TAG);

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("readable_players")
    .select("id,display_name,moxfield_url")
    .order("display_name", { ascending: true });
  if (error) throw new Error("Unable to load the registered playgroup members.");
  return (data ?? []).map((player) => ({ id: player.id, name: player.display_name, moxfieldUrl: player.moxfield_url }));
}
