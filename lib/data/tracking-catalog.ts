import "server-only";
import { getPublicCommanderCatalog, getPublicDeckCatalog } from "@/lib/data/public-profiles";
import { getPublicPlayers } from "@/lib/data/public-players";

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
  const [players, commanders, profileDecks] = await Promise.all([
    getPublicPlayers(),
    getPublicCommanderCatalog(),
    getPublicDeckCatalog(),
  ]);

  return {
    players: players.map(({ id, name }) => ({ id, name })),
    commanders,
    decks: profileDecks.map((deck) => ({
      id: deck.id,
      playerId: deck.ownerId,
      playerName: deck.ownerName,
      commanderId: deck.commanderId,
      commanderName: deck.commanderName,
      deckName: deck.name,
    })),
  };
}
