import { getEligibility } from "../historical/model.ts";
import type { StatsGame, StatsPlayer } from "./dashboard.ts";
import type { OpponentDeckMatchupStat, ProfileDeck } from "./profiles.ts";

export interface PlayerSharedMatchup {
  playerId: string;
  playerName: string;
  opponentId: string;
  opponentName: string;
  sharedGames: number;
  wins: number;
  winRate: number;
  gameIds: string[];
}

function compareGames(a: StatsGame, b: StatsGame): number {
  return a.playedOn.localeCompare(b.playedOn)
    || a.gameNumberOnDate - b.gameNumberOnDate
    || a.id.localeCompare(b.id);
}

function isWinEligible(game: StatsGame): boolean {
  return getEligibility(
    { podSize: game.podSize, result: game.result, winnerSeat: game.winningSeat },
    game.participants.map((participant) => ({ playerId: participant.playerId })),
  ).winStatsEligible;
}

/**
 * Builds directional member-versus-member results from their multiplayer shared pods.
 * Third-party and guest winners stay in the denominator but do not become member wins.
 */
export function calculatePlayerSharedMatchups(
  games: StatsGame[],
  registeredPlayers: StatsPlayer[],
): PlayerSharedMatchup[] {
  const playerById = new Map(registeredPlayers.map((player) => [player.id, player]));
  const counts = new Map<string, { playerId: string; opponentId: string; sharedGames: number; wins: number; gameIds: string[] }>();

  for (const game of [...games].sort(compareGames)) {
    if (!isWinEligible(game) || game.winningSeat === null) continue;
    const membersById = new Map<string, { id: string; seat: number }>();
    for (const participant of game.participants) {
      if (participant.playerId && playerById.has(participant.playerId) && !membersById.has(participant.playerId)) {
        membersById.set(participant.playerId, { id: participant.playerId, seat: participant.seat });
      }
    }
    const members = [...membersById.values()];
    for (const player of members) {
      for (const opponent of members) {
        if (player.id === opponent.id) continue;
        const key = `${player.id}\u0000${opponent.id}`;
        const row = counts.get(key) ?? {
          playerId: player.id,
          opponentId: opponent.id,
          sharedGames: 0,
          wins: 0,
          gameIds: [],
        };
        row.sharedGames += 1;
        if (player.seat === game.winningSeat) row.wins += 1;
        row.gameIds.push(game.id);
        counts.set(key, row);
      }
    }
  }

  return [...counts.values()].map((row) => ({
    playerId: row.playerId,
    playerName: playerById.get(row.playerId)!.name,
    opponentId: row.opponentId,
    opponentName: playerById.get(row.opponentId)!.name,
    sharedGames: row.sharedGames,
    wins: row.wins,
    winRate: row.wins / row.sharedGames,
    gameIds: row.gameIds,
  })).sort((a, b) =>
    a.playerName.localeCompare(b.playerName)
      || a.opponentName.localeCompare(b.opponentName)
      || a.playerId.localeCompare(b.playerId)
      || a.opponentId.localeCompare(b.opponentId));
}

/**
 * Shared source for Deck Profile and Analytics deck-versus-deck comparisons.
 * Each opposing member-owned deck is counted at most once per eligible pod.
 */
export function calculateDeckOpponentMatchups(
  selectedDeckId: string,
  eligibleGames: StatsGame[],
  registeredDecks: ReadonlyMap<string, ProfileDeck>,
): OpponentDeckMatchupStat[] {
  const counts = new Map<string, { sharedGames: number; wins: number; gameIds: string[] }>();
  for (const game of [...eligibleGames].sort(compareGames)) {
    if (!isWinEligible(game) || game.winningSeat === null) continue;
    const selected = game.participants.find((participant) => participant.deckId === selectedDeckId);
    if (!selected) continue;
    const seenOpponentDecks = new Set<string>();
    for (const participant of game.participants) {
      const opponentDeckId = participant.deckId;
      if (!opponentDeckId || opponentDeckId === selectedDeckId || seenOpponentDecks.has(opponentDeckId)) continue;
      if (!registeredDecks.has(opponentDeckId)) continue;
      seenOpponentDecks.add(opponentDeckId);
      const row = counts.get(opponentDeckId) ?? { sharedGames: 0, wins: 0, gameIds: [] };
      row.sharedGames += 1;
      if (selected.seat === game.winningSeat) row.wins += 1;
      row.gameIds.push(game.id);
      counts.set(opponentDeckId, row);
    }
  }

  return [...counts.entries()].flatMap(([deckId, row]) => {
    const deck = registeredDecks.get(deckId);
    if (!deck) return [];
    return [{
      deckId,
      ownerId: deck.ownerId,
      ownerName: deck.ownerName,
      name: deck.name,
      commanderName: deck.commanderName,
      sharedGames: row.sharedGames,
      wins: row.wins,
      winRate: row.wins / row.sharedGames,
      gameIds: row.gameIds,
    }];
  }).sort((a, b) =>
    b.sharedGames - a.sharedGames
      || a.ownerName.localeCompare(b.ownerName)
      || a.name.localeCompare(b.name)
      || a.deckId.localeCompare(b.deckId));
}
