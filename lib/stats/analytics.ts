import { getEligibility } from "../historical/model.ts";
import {
  calculateEloHistory,
  getDashboardWindow,
  type DashboardRange,
  type EloHistoryResult,
  type StatsGame,
  type StatsPlayer,
} from "./dashboard.ts";
import {
  calculateDeckOpponentMatchups,
  calculatePlayerSharedMatchups,
} from "./matchups.ts";
import {
  type ColorIdentity,
  type CommanderMetadataById,
  type OpponentDeckMatchupStat,
  type ProfileDeck,
  type PodFilter,
  PLAYER_COMPARISON_MINIMUM_GAMES,
  DECK_RANKING_MINIMUM_GAMES,
} from "./profiles.ts";

export const CORE_FOUR_NAMES = ["Nelson", "Will", "Manfred", "Josh"] as const;
export const PLAYER_MATRIX_HIGHLIGHT_MINIMUM_GAMES = 5;
export const ANALYTICS_ROLLING_WINDOW_GAMES = 10;

export interface AnalyticsFilters {
  podFilter: PodFilter;
  range: DashboardRange;
  today: string;
  coreFourOnly: boolean;
}

export interface AnalyticsPopulation {
  window: ReturnType<typeof getDashboardWindow>;
  recordedGames: StatsGame[];
  historyGames: StatsGame[];
  eligibleGames: StatsGame[];
  coreFourEligibleGames: StatsGame[];
  coreFourOnlyApplied: boolean;
}

export interface ExpectedPerformanceRow {
  id: string;
  name: string;
  ownerName?: string;
  commanderName?: string;
  games: number;
  wins: number;
  expectedWins: number;
  winSurplus: number | null;
  winRate: number | null;
  expectedWinRate: number | null;
  elo: number | null;
  qualifiesForRanking: boolean;
}

export interface SeatPositionStat {
  seat: number;
  appearances: number;
  wins: number;
  expectedWins: number;
  winRate: number | null;
  expectedWinRate: number | null;
}

export interface PlayerSeatStat {
  playerId: string;
  playerName: string;
  seats: SeatPositionStat[];
}

export interface AnalyticsTrendPoint {
  gameId: string;
  playedOn: string;
  gameNumberOnDate: number;
  appearances: number;
  cumulativeWins: number;
  cumulativeWinRate: number;
  rollingGames: number;
  rollingWinRate: number | null;
  elo: number | null;
}

export interface AnalyticsTrendSeries {
  id: string;
  name: string;
  kind: "player" | "deck";
  ownerName?: string;
  commanderName?: string;
  appearances: number;
  points: AnalyticsTrendPoint[];
}

export interface AnalyticsTrendDefaults {
  playerSeries: AnalyticsTrendSeries[];
  playerDefaultIds: string[];
  deckSeries: AnalyticsTrendSeries[];
  deckDefaultIds: string[];
}

export type ColorBucket = "Colorless" | "Mono-color" | "Two-color" | "Three-color" | "Four-color" | "Five-color";

export interface ColorAnalysis {
  totalDeckAppearances: number;
  knownAppearances: number;
  unknownAppearances: number;
  totalDecks: number;
  knownDecks: number;
  unknownDecks: number;
  colorUsage: Array<{ color: Exclude<ColorIdentity, "C">; appearances: number; shareOfKnownAppearances: number }>;
  identityDistribution: Array<{ bucket: ColorBucket; appearances: number; share: number }>;
  colorPerformance: Array<{ color: ColorIdentity; appearances: number; wins: number; winRate: number | null }>;
  playerPreferences: Array<{
    playerId: string;
    playerName: string;
    knownAppearances: number;
    unknownAppearances: number;
    knownDecks: number;
    colorUses: Array<{ color: ColorIdentity; appearances: number; uniqueDecks: number }>;
    distinctColorsUsed: number;
  }>;
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

function matchesPod(game: StatsGame, podFilter: PodFilter): boolean {
  if (podFilter === "3") return game.podSize === 3;
  if (podFilter === "4") return game.podSize === 4;
  return game.podSize >= 5;
}

function withinWindow(game: StatsGame, startDate: string | null, endDate: string): boolean {
  return game.playedOn <= endDate && (!startDate || game.playedOn >= startDate);
}

function coreFourIds(players: StatsPlayer[]): Set<string> {
  const required = new Set(CORE_FOUR_NAMES.map((name) => name.toLocaleLowerCase()));
  return new Set(players
    .filter((player) => required.has(player.name.trim().toLocaleLowerCase()))
    .map((player) => player.id));
}

export function isCoreFourGame(game: StatsGame, players: StatsPlayer[]): boolean {
  if (game.podSize !== 4 || game.participants.length !== 4) return false;
  const ids = coreFourIds(players);
  if (ids.size !== CORE_FOUR_NAMES.length) return false;
  const memberIds = new Set(game.participants.map((participant) => participant.playerId).filter((id): id is string => id !== null));
  return memberIds.size === 4 && [...ids].every((id) => memberIds.has(id));
}

/** Builds one date/pod population for every Analytics panel. */
export function buildAnalyticsPopulation(
  sourceGames: StatsGame[],
  players: StatsPlayer[],
  filters: AnalyticsFilters,
): AnalyticsPopulation {
  const window = getDashboardWindow(filters.range, filters.today);
  const podHistoryGames = sourceGames
    .filter((game) => matchesPod(game, filters.podFilter) && game.playedOn <= window.endDate)
    .sort(compareGames);
  const podDateGames = podHistoryGames.filter((game) => withinWindow(game, window.startDate, window.endDate));
  const coreFourEligibleGames = filters.podFilter === "4"
    ? podDateGames.filter((game) => isCoreFourGame(game, players) && isWinEligible(game))
    : [];
  const coreFourOnlyApplied = filters.coreFourOnly && filters.podFilter === "4";
  const selectedHistoryGames = coreFourOnlyApplied
    ? podHistoryGames.filter((game) => isCoreFourGame(game, players))
    : podHistoryGames;
  const selectedGames = coreFourOnlyApplied
    ? podDateGames.filter((game) => isCoreFourGame(game, players))
    : podDateGames;
  const recordedGames = selectedGames.filter((game) => !window.startDate || game.playedOn >= window.startDate);
  const historyGames = selectedHistoryGames.filter(isWinEligible);
  const eligibleGames = historyGames.filter((game) => !window.startDate || game.playedOn >= window.startDate);
  return { window, recordedGames, historyGames, eligibleGames, coreFourEligibleGames, coreFourOnlyApplied };
}

function expectedPerformance(
  games: StatsGame[],
  entities: Array<{ id: string; name: string; ownerName?: string; commanderName?: string }>,
  identity: "player" | "deck",
  minimumGames: number,
  eloHistory?: EloHistoryResult,
): ExpectedPerformanceRow[] {
  const counts = new Map(entities.map((entity) => [entity.id, { games: 0, wins: 0, expectedWins: 0 }]));
  const names = new Map(entities.map((entity) => [entity.id, entity]));
  for (const game of games) {
    if (!isWinEligible(game) || game.winningSeat === null) continue;
    const seen = new Set<string>();
    for (const participant of game.participants) {
      const id = identity === "player" ? participant.playerId : participant.deckId;
      if (!id || !counts.has(id) || seen.has(id)) continue;
      seen.add(id);
      const row = counts.get(id)!;
      row.games += 1;
      row.expectedWins += 1 / game.podSize;
      if (participant.seat === game.winningSeat) row.wins += 1;
    }
  }
  return [...counts.entries()].map(([id, count]) => {
    const entity = names.get(id)!;
    const winRate = count.games ? count.wins / count.games : null;
    return {
      id,
      name: entity.name,
      ownerName: entity.ownerName,
      commanderName: entity.commanderName,
      games: count.games,
      wins: count.wins,
      expectedWins: count.expectedWins,
      winSurplus: count.games ? count.wins - count.expectedWins : null,
      winRate,
      expectedWinRate: count.games ? count.expectedWins / count.games : null,
      elo: eloHistory?.ratings.has(id) ? Math.round(eloHistory.ratings.get(id)!) : null,
      qualifiesForRanking: count.games >= minimumGames,
    };
  }).sort((a, b) =>
    Number(b.qualifiesForRanking) - Number(a.qualifiesForRanking)
      || (b.winSurplus ?? Number.NEGATIVE_INFINITY) - (a.winSurplus ?? Number.NEGATIVE_INFINITY)
      || b.games - a.games
      || a.name.localeCompare(b.name)
      || a.id.localeCompare(b.id));
}

export function buildPlayerExpectedPerformance(games: StatsGame[], players: StatsPlayer[], eloHistory?: EloHistoryResult): ExpectedPerformanceRow[] {
  return expectedPerformance(games, players, "player", PLAYER_COMPARISON_MINIMUM_GAMES, eloHistory);
}

/** Uses the same ten-eligible-game flag as player performance rankings. */
export function getQualifiedPlayerComparisons(rows: ExpectedPerformanceRow[]): ExpectedPerformanceRow[] {
  return rows.filter((row) => row.qualifiesForRanking);
}

export function buildDeckExpectedPerformance(games: StatsGame[], decks: ProfileDeck[], eloHistory?: EloHistoryResult): ExpectedPerformanceRow[] {
  return expectedPerformance(games, decks.map((deck) => ({
    id: deck.id,
    name: deck.name,
    ownerName: deck.ownerName,
    commanderName: deck.commanderName,
  })), "deck", DECK_RANKING_MINIMUM_GAMES, eloHistory);
}

export function buildSeatPositionStats(games: StatsGame[]): SeatPositionStat[] {
  const counts = new Map<number, { appearances: number; wins: number; expectedWins: number }>();
  for (const game of games) {
    if (!isWinEligible(game) || game.winningSeat === null) continue;
    const seenSeats = new Set<number>();
    for (const participant of game.participants) {
      if (seenSeats.has(participant.seat)) continue;
      seenSeats.add(participant.seat);
      const row = counts.get(participant.seat) ?? { appearances: 0, wins: 0, expectedWins: 0 };
      row.appearances += 1;
      row.expectedWins += 1 / game.podSize;
      if (participant.seat === game.winningSeat) row.wins += 1;
      counts.set(participant.seat, row);
    }
  }
  return [...counts.entries()].sort(([a], [b]) => a - b).map(([seat, row]) => ({
    seat,
    ...row,
    winRate: row.appearances ? row.wins / row.appearances : null,
    expectedWinRate: row.appearances ? row.expectedWins / row.appearances : null,
  }));
}

export function buildPlayerSeatStats(games: StatsGame[], players: StatsPlayer[]): PlayerSeatStat[] {
  const byPlayer = new Map(players.map((player) => [player.id, new Map<number, { appearances: number; wins: number }>()]));
  for (const game of games) {
    if (!isWinEligible(game) || game.winningSeat === null) continue;
    const seenPlayers = new Set<string>();
    for (const participant of game.participants) {
      const id = participant.playerId;
      if (!id || !byPlayer.has(id) || seenPlayers.has(id)) continue;
      seenPlayers.add(id);
      const seats = byPlayer.get(id)!;
      const row = seats.get(participant.seat) ?? { appearances: 0, wins: 0 };
      row.appearances += 1;
      if (participant.seat === game.winningSeat) row.wins += 1;
      seats.set(participant.seat, row);
    }
  }
  return players.map((player) => ({
    playerId: player.id,
    playerName: player.name,
    seats: [...byPlayer.get(player.id)!.entries()].sort(([a], [b]) => a - b).map(([seat, row]) => ({
      seat,
      appearances: row.appearances,
      wins: row.wins,
      expectedWins: 0,
      winRate: row.appearances ? row.wins / row.appearances : null,
      expectedWinRate: null,
    })),
  }));
}

const COLORS: readonly ColorIdentity[] = ["W", "U", "B", "R", "G", "C"];
const COLOR_BUCKETS: readonly ColorBucket[] = ["Colorless", "Mono-color", "Two-color", "Three-color", "Four-color", "Five-color"];

function colorBucket(colors: ColorIdentity[]): ColorBucket {
  if (colors.length === 0) return "Colorless";
  return COLOR_BUCKETS[Math.min(colors.length, 5)] ?? "Five-color";
}

export function buildColorAnalysis(
  games: StatsGame[],
  players: StatsPlayer[],
  decks: ProfileDeck[],
  metadataById: CommanderMetadataById,
): ColorAnalysis {
  const deckById = new Map(decks.map((deck) => [deck.id, deck]));
  const deckAppearances = new Map<string, number>();
  const knownDecks = new Set<string>();
  let knownAppearances = 0;
  const uniqueByIdentity = new Map<ColorBucket, number>(COLOR_BUCKETS.map((bucket) => [bucket, 0]));
  const usesByColor = new Map<ColorIdentity, number>(COLORS.map((color) => [color, 0]));
  const performanceByColor = new Map<ColorIdentity, { appearances: number; wins: number }>(COLORS.map((color) => [color, { appearances: 0, wins: 0 }]));
  const playerCounts = new Map<string, {
    knownAppearances: number;
    unknownAppearances: number;
    decks: Set<string>;
    colorCounts: Map<ColorIdentity, { appearances: number; decks: Set<string> }>;
  }>(players.map((player) => [player.id, {
    knownAppearances: 0,
    unknownAppearances: 0,
    decks: new Set(),
    colorCounts: new Map(COLORS.map((color) => [color, { appearances: 0, decks: new Set<string>() }])),
  }]));

  for (const game of games) {
    if (!isWinEligible(game) || game.winningSeat === null) continue;
    for (const participant of game.participants) {
      if (!participant.deckId) continue;
      const deck = deckById.get(participant.deckId);
      if (!deck) continue;
      deckAppearances.set(deck.id, (deckAppearances.get(deck.id) ?? 0) + 1);
      const metadata = metadataById.get(deck.commanderId);
      const player = participant.playerId ? playerCounts.get(participant.playerId) : undefined;
      if (!metadata || metadata.colors === null) {
        if (player) player.unknownAppearances += 1;
        continue;
      }
      const colors = metadata.colors;
      const category = colorBucket(colors);
      uniqueByIdentity.set(category, (uniqueByIdentity.get(category) ?? 0) + 1);
      knownDecks.add(deck.id);
      knownAppearances += 1;
      if (player) {
        player.knownAppearances += 1;
        player.decks.add(deck.id);
      }
      const activeColors = colors.length ? colors : ["C" as const];
      for (const color of activeColors) {
        usesByColor.set(color, (usesByColor.get(color) ?? 0) + 1);
        const performance = performanceByColor.get(color)!;
        performance.appearances += 1;
        if (participant.seat === game.winningSeat) performance.wins += 1;
        if (player) {
          const playerColor = player.colorCounts.get(color)!;
          playerColor.appearances += 1;
          playerColor.decks.add(deck.id);
        }
      }
    }
  }

  const totalDeckAppearances = [...deckAppearances.values()].reduce((sum, count) => sum + count, 0);
  const totalDecks = deckAppearances.size;
  const knownDeckCount = knownDecks.size;
  const knownIdentityAppearances = [...uniqueByIdentity.values()].reduce((sum, count) => sum + count, 0);
  const wubrg: Exclude<ColorIdentity, "C">[] = ["W", "U", "B", "R", "G"];

  return {
    totalDeckAppearances,
    knownAppearances,
    unknownAppearances: totalDeckAppearances - knownAppearances,
    totalDecks,
    knownDecks: knownDeckCount,
    unknownDecks: totalDecks - knownDeckCount,
    colorUsage: wubrg.map((color) => ({
      color,
      appearances: usesByColor.get(color) ?? 0,
      shareOfKnownAppearances: knownAppearances ? (usesByColor.get(color) ?? 0) / knownAppearances : 0,
    })),
    identityDistribution: COLOR_BUCKETS.map((bucket) => {
      const appearances = uniqueByIdentity.get(bucket) ?? 0;
      return { bucket, appearances, share: knownIdentityAppearances ? appearances / knownIdentityAppearances : 0 };
    }),
    colorPerformance: COLORS.map((color) => {
      const row = performanceByColor.get(color)!;
      return { color, ...row, winRate: row.appearances ? row.wins / row.appearances : null };
    }),
    playerPreferences: players.map((player) => {
      const row = playerCounts.get(player.id)!;
      const colorUses = COLORS.map((color) => {
        const counts = row.colorCounts.get(color)!;
        return { color, appearances: counts.appearances, uniqueDecks: counts.decks.size };
      });
      return {
        playerId: player.id,
        playerName: player.name,
        knownAppearances: row.knownAppearances,
        unknownAppearances: row.unknownAppearances,
        knownDecks: row.decks.size,
        colorUses,
        distinctColorsUsed: colorUses.filter((item) => item.appearances > 0).length,
      };
    }).sort((a, b) =>
      (b.knownAppearances + b.unknownAppearances) - (a.knownAppearances + a.unknownAppearances)
        || a.playerName.localeCompare(b.playerName)
        || a.playerId.localeCompare(b.playerId)),
  };
}

function trendsForIdentity(
  games: StatsGame[],
  entities: Array<{ id: string; name: string; ownerName?: string; commanderName?: string }>,
  kind: "player" | "deck",
  ratings: EloHistoryResult,
  startDate: string | null,
): AnalyticsTrendSeries[] {
  const entityById = new Map(entities.map((entity) => [entity.id, entity]));
  const events = new Map<string, Array<{ game: StatsGame; won: boolean; rating: number | null }>>();
  for (const entity of entities) events.set(entity.id, []);
  const ratingByGame = new Map<string, Map<string, number>>();
  for (const [entityId, points] of ratings.history) {
    ratingByGame.set(entityId, new Map(points.map((point) => [point.gameId, point.rating])));
  }
  for (const game of [...games].sort(compareGames)) {
    if (!isWinEligible(game) || game.winningSeat === null) continue;
    const seen = new Set<string>();
    for (const participant of game.participants) {
      const id = kind === "player" ? participant.playerId : participant.deckId;
      if (!id || !entityById.has(id) || seen.has(id)) continue;
      seen.add(id);
      events.get(id)!.push({
        game,
        won: participant.seat === game.winningSeat,
        rating: ratingByGame.get(id)?.get(game.id) ?? null,
      });
    }
  }

  return [...events.entries()].flatMap(([id, identityEvents]) => {
    const entity = entityById.get(id)!;
    let wins = 0;
    const rolling: boolean[] = [];
    const points: AnalyticsTrendPoint[] = [];
    for (const [index, event] of identityEvents.entries()) {
      if (event.won) wins += 1;
      rolling.push(event.won);
      if (rolling.length > ANALYTICS_ROLLING_WINDOW_GAMES) rolling.shift();
      if (startDate && event.game.playedOn < startDate) continue;
      const rollingWins = rolling.reduce((sum, won) => sum + Number(won), 0);
      points.push({
        gameId: event.game.id,
        playedOn: event.game.playedOn,
        gameNumberOnDate: event.game.gameNumberOnDate,
        appearances: index + 1,
        cumulativeWins: wins,
        cumulativeWinRate: wins / (index + 1),
        rollingGames: rolling.length,
        rollingWinRate: rolling.length === ANALYTICS_ROLLING_WINDOW_GAMES ? rollingWins / ANALYTICS_ROLLING_WINDOW_GAMES : null,
        elo: event.rating === null ? null : Math.round(event.rating),
      });
    }
    if (!points.length) return [];
    return [{
      id,
      name: entity.name,
      kind,
      ownerName: entity.ownerName,
      commanderName: entity.commanderName,
      appearances: identityEvents.length,
      points,
    }];
  }).sort((a, b) => b.appearances - a.appearances || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

export function buildAnalyticsTrendSeries(
  historyGames: StatsGame[],
  players: StatsPlayer[],
  decks: ProfileDeck[],
  playerRatings: EloHistoryResult,
  deckRatings: EloHistoryResult,
  startDate: string | null,
): { players: AnalyticsTrendSeries[]; decks: AnalyticsTrendSeries[] } {
  return {
    players: trendsForIdentity(historyGames, players, "player", playerRatings, startDate),
    decks: trendsForIdentity(historyGames, decks, "deck", deckRatings, startDate),
  };
}

/**
 * Limits plotted identities to the current comparison population. Player trends
 * include every 10-game-qualified player; deck choices keep the five-game floor,
 * while the focused deck stays selectable and is the only default selection.
 */
export function buildAnalyticsTrendDefaults(
  trends: { players: AnalyticsTrendSeries[]; decks: AnalyticsTrendSeries[] },
  playerPerformance: ExpectedPerformanceRow[],
  deckPerformance: ExpectedPerformanceRow[],
  focusedDeckId = "",
): AnalyticsTrendDefaults {
  const playerTrendsById = new Map(trends.players.map((series) => [series.id, series]));
  const deckTrendsById = new Map(trends.decks.map((series) => [series.id, series]));
  const playerSeries = getQualifiedPlayerComparisons(playerPerformance)
    .flatMap((row) => {
      const series = playerTrendsById.get(row.id);
      return series ? [series] : [];
    });
  const selectableDeckRows = deckPerformance
    .filter((row) => row.qualifiesForRanking)
    .sort((a, b) =>
      b.games - a.games
        || (a.ownerName ?? "").localeCompare(b.ownerName ?? "")
        || (a.commanderName ?? a.name).localeCompare(b.commanderName ?? b.name)
        || a.id.localeCompare(b.id));
  const focusedDeck = deckPerformance.find((row) => row.id === focusedDeckId);
  if (focusedDeck && !focusedDeck.qualifiesForRanking) selectableDeckRows.push(focusedDeck);
  const deckSeries = selectableDeckRows.map((row) => deckTrendsById.get(row.id) ?? {
    id: row.id,
    name: row.name,
    kind: "deck" as const,
    ownerName: row.ownerName,
    commanderName: row.commanderName,
    appearances: 0,
    points: [],
  });
  const deckDefaultIds = focusedDeck && deckSeries.some((series) => series.id === focusedDeckId)
    ? [focusedDeckId]
    : [];
  return {
    playerSeries,
    playerDefaultIds: playerSeries.map((series) => series.id),
    deckSeries,
    deckDefaultIds,
  };
}

export { calculateDeckOpponentMatchups, calculatePlayerSharedMatchups };
export { calculateEloHistory };
export type { OpponentDeckMatchupStat };
