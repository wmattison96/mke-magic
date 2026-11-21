import "server-only";
import { getPublicGameLog } from "@/lib/data/public-game-log";
import { getPublicPlayers } from "@/lib/data/public-players";
import { createClient } from "@/lib/supabase/server";
import type { StatsGame } from "@/lib/stats/dashboard";
import type { ProfileDeck } from "@/lib/stats/profiles";

export interface PublicProfileData {
  games: StatsGame[];
  players: Awaited<ReturnType<typeof getPublicPlayers>>;
  decks: ProfileDeck[];
}

export async function getPublicDeckCatalog(): Promise<ProfileDeck[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("readable_member_decks")
    .select("id,owner_player_id,owner_name,commander_id,canonical_name,deck_name,moxfield_url")
    .order("owner_name", { ascending: true })
    .order("deck_name", { ascending: true });
  if (error) throw new Error("Unable to load the member-owned deck directory.");
  return (data ?? []).map((row) => ({
    id: row.id,
    ownerId: row.owner_player_id,
    ownerName: row.owner_name,
    commanderId: row.commander_id,
    commanderName: row.canonical_name,
    name: row.deck_name,
    moxfieldUrl: row.moxfield_url,
  }));
}

export async function getPublicProfileData(): Promise<PublicProfileData> {
  const [log, players, decks] = await Promise.all([
    getPublicGameLog(),
    getPublicPlayers(),
    getPublicDeckCatalog(),
  ]);
  return {
    games: log.map((game) => ({
      id: game.id,
      playedOn: game.playedOn,
      gameNumberOnDate: game.gameNumberOnDate,
      podSize: game.podSize,
      result: game.result,
      winningSeat: game.winningSeat,
      participants: game.participants.map((participant) => ({
        seat: participant.seat,
        playerId: participant.playerId,
        playerName: participant.publicPlayerName,
        deckId: participant.deckId,
        deckName: participant.deckName,
        commanderId: participant.commanderId,
        commanderName: participant.commanderName,
        isWinner: participant.isWinner,
      })),
    })),
    players,
    decks,
  };
}
