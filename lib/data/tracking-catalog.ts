import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface TrackingCatalog {
  players: Array<{ id: string; name: string }>;
  commanders: Array<{ id: string; name: string }>;
  decks: Array<{
    id: string;
    playerId: string;
    playerName: string;
    commanderId: string;
    commanderName: string;
    deckName: string;
  }>;
}

/** Only reads the public projections; private memberships and guest provenance stay server-side. */
export async function getTrackingCatalog(): Promise<TrackingCatalog> {
  const supabase = await createClient();
  const [playersResult, commandersResult, decksResult] = await Promise.all([
    supabase.from("readable_players").select("id,display_name").order("display_name"),
    supabase.from("readable_commanders").select("id,canonical_name").order("canonical_name"),
    supabase.from("readable_member_decks").select("id,owner_player_id,owner_name,commander_id,canonical_name,deck_name").order("deck_name"),
  ]);

  if (playersResult.error || commandersResult.error || decksResult.error) {
    throw new Error("Unable to load the member, deck, and commander choices.");
  }

  return {
    players: (playersResult.data ?? []).map((row) => ({ id: row.id, name: row.display_name })),
    commanders: (commandersResult.data ?? []).map((row) => ({ id: row.id, name: row.canonical_name })),
    decks: (decksResult.data ?? []).map((row) => ({
      id: row.id,
      playerId: row.owner_player_id,
      playerName: row.owner_name,
      commanderId: row.commander_id,
      commanderName: row.canonical_name,
      deckName: row.deck_name,
    })),
  };
}
