import { getEligibility } from "../historical/model.ts";
import { calculateDeckOpponentMatchups, calculatePlayerSharedMatchups } from "./matchups.ts";
import {
  calculateEloHistory,
  DEFAULT_PROVISIONAL_ELO_CONFIG,
  type EloHistoryPoint,
  type ProvisionalEloConfig,
  type StatsGame,
  type StatsPlayer,
} from "./dashboard.ts";

export type PodFilter = "3" | "4" | "5plus";
export type ColorIdentity = "W" | "U" | "B" | "R" | "G" | "C";

export const PLAYER_COMPARISON_MINIMUM_GAMES = 10;
export const PLAYER_DECK_RATE_MINIMUM_GAMES = 4;
export const DECK_RANKING_MINIMUM_GAMES = 5;
export const PLAYER_OPPONENT_DECK_MATCHUP_MINIMUM_GAMES = 5;
export const DECK_OPPONENT_DECK_MATCHUP_MINIMUM_GAMES = 3;
export const OPPONENT_DECK_MATCHUP_LIST_SIZE = 3;
export const OPPONENT_DECK_MOST_FACED_LIST_SIZE = 3;
export const FOUR_PLAYER_DECK_QUADRANT_THRESHOLD_GAMES = 10;

export interface ProfileDeck {
  id: string;
  ownerId: string;
  ownerName: string;
  commanderId: string;
  commanderName: string;
  name: string;
  moxfieldUrl: string | null;
}

export interface CommanderMetadata {
  colors: ColorIdentity[] | null;
  artUrl: string | null;
}

export type CommanderMetadataById = ReadonlyMap<string, CommanderMetadata>;

/** Combines commander or partner identities while preserving unknown metadata as unknown. */
export function combineCommanderColorIdentities(
  identities: Array<readonly ColorIdentity[] | null>,
): ColorIdentity[] | null {
  if (!identities.length || identities.some((identity) => identity === null)) return null;
  const union = new Set(identities.flatMap((identity) => identity ?? []));
  const order: ColorIdentity[] = ["W", "U", "B", "R", "G", "C"];
  return order.filter((color) => union.has(color));
}

export interface EligibleTotals {
  recordedAppearances: number;
  participationEligibleAppearances: number;
  winEligibleGames: number;
  wins: number;
  winRate: number | null;
}

export interface SeatPerformance extends EligibleTotals {
  seat: number;
  appearanceShare: number;
}

export interface ProfileTrendPoint extends EloHistoryPoint {
  wins: number;
  winRate: number;
}

export interface ColorDistribution {
  color: ColorIdentity;
  count: number;
  share: number;
}

export interface ColorBreakdown {
  rows: ColorDistribution[];
  knownEntities: number;
  totalEntities: number;
  unknownEntities: number;
  knownAppearances: number;
  totalAppearances: number;
  unknownAppearances: number;
}

export interface DeckPerformance extends EligibleTotals {
  id: string;
  ownerId: string;
  ownerName: string;
  name: string;
  commanderId: string;
  commanderName: string;
  elo: number | null;
  eloGames: number;
  rank: number | null;
  moxfieldUrl: string | null;
}

export interface PlayerOpponentStat {
  playerId: string;
  name: string;
  sharedGames: number;
  wins: number;
  winRate: number;
}

export interface OpponentDeckMatchupStat {
  deckId: string;
  ownerId: string;
  ownerName: string;
  name: string;
  commanderName: string;
  sharedGames: number;
  wins: number;
  winRate: number;
  gameIds: string[];
}

export interface RecentProfileGame {
  game: StatsGame;
  outcome: "Won" | "Lost" | "Noncompetitive";
}

export interface StreakStats {
  longestWins: number;
  longestLosses: number;
}

export interface PlayerProfileStats {
  player: StatsPlayer;
  podFilter: PodFilter;
  totalGamesInPod: number;
  totals: EligibleTotals;
  expectedWinRate: number | null;
  elo: number | null;
  eloGames: number;
  competitiveRank: number | null;
  meetsComparisonMinimum: boolean;
  distinctDecksPlayed: number;
  mostPlayedDeck: ProfileDeck | null;
  decks: DeckPerformance[];
  seats: SeatPerformance[];
  colorsByDeck: ColorBreakdown;
  colorsByGame: ColorBreakdown;
  trends: ProfileTrendPoint[];
  opponents: PlayerOpponentStat[];
  mostFacedDecks: OpponentDeckMatchupStat[];
  bestMatchups: OpponentDeckMatchupStat[];
  toughestMatchups: OpponentDeckMatchupStat[];
  streaks: StreakStats;
  peakElo: number | null;
  minimumElo: number | null;
  recentGames: RecentProfileGame[];
}

export interface DeckQuadrantPoint {
  deckId: string;
  ownerId: string;
  ownerName: string;
  name: string;
  games: number;
  wins: number;
  winRate: number;
  elo: number | null;
}

export interface DeckQuadrantThreshold {
  games: number;
  basis: "fixed-four-player" | "selected-sample-median";
  medianGames: number | null;
}

export type DeckQuadrantClassification =
  | "promising"
  | "proven-performer"
  | "underperforming-unproven"
  | "frequent-underperformer";

export interface DeckProfileStats {
  deck: ProfileDeck;
  owner: StatsPlayer | null;
  podFilter: PodFilter;
  totalGamesInPod: number;
  totals: EligibleTotals;
  elo: number | null;
  eloGames: number;
  meetsRankingMinimum: boolean;
  commanderMetadata: CommanderMetadata;
  seats: SeatPerformance[];
  trends: ProfileTrendPoint[];
  streaks: StreakStats;
  peakElo: number | null;
  minimumElo: number | null;
  mostFacedDecks: OpponentDeckMatchupStat[];
  bestMatchups: OpponentDeckMatchupStat[];
  toughestMatchups: OpponentDeckMatchupStat[];
  quadrantPoints: DeckQuadrantPoint[];
  quadrantThreshold: DeckQuadrantThreshold;
  quadrantExpectedWinRate: number | null;
  recentGames: RecentProfileGame[];
}

export interface ProfileStatistics {
  podFilter: PodFilter;
  totalGamesInPod: number;
  participationEligibleGames: number;
  winEligibleGames: number;
  officialFourPlayerGames: number;
  players: Map<string, PlayerProfileStats>;
  deckDirectory: DeckPerformance[];
  decks: Map<string, DeckProfileStats>;
}

interface MutableCounts {
  recordedAppearances: number;
  participationEligibleAppearances: number;
  winEligibleGames: number;
  wins: number;
}

function emptyCounts(): MutableCounts {
  return { recordedAppearances: 0, participationEligibleAppearances: 0, winEligibleGames: 0, wins: 0 };
}

function finishCounts(counts: MutableCounts): EligibleTotals {
  return {
    ...counts,
    winRate: counts.winEligibleGames > 0 ? counts.wins / counts.winEligibleGames : null,
  };
}

export function parsePodFilter(value: string | string[] | undefined): PodFilter {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate === "3" || candidate === "5plus" ? candidate : "4";
}

export function sortPlayerDirectoryProfiles(profiles: Iterable<PlayerProfileStats>): PlayerProfileStats[] {
  return [...profiles].sort((a, b) =>
    b.totals.winEligibleGames - a.totals.winEligibleGames
      || (b.totals.winRate ?? -1) - (a.totals.winRate ?? -1)
      || a.player.name.localeCompare(b.player.name)
      || a.player.id.localeCompare(b.player.id));
}

export function getDeckQuadrantThreshold(
  points: Array<Pick<DeckQuadrantPoint, "games">>,
  podFilter: PodFilter,
): DeckQuadrantThreshold {
  if (!points.length) return { games: 0, basis: podFilter === "4" ? "fixed-four-player" : "selected-sample-median", medianGames: null };
  if (podFilter === "4") {
    return { games: FOUR_PLAYER_DECK_QUADRANT_THRESHOLD_GAMES, basis: "fixed-four-player", medianGames: null };
  }
  const sorted = points.map((point) => point.games).sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const medianGames = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  return { games: Math.max(2, Math.ceil(medianGames)), basis: "selected-sample-median", medianGames };
}

export function getDeckQuadrantAxisMax(
  points: Array<Pick<DeckQuadrantPoint, "games">>,
  thresholdGames: number,
): number {
  const maximum = Math.max(1, thresholdGames, ...points.map((point) => point.games));
  const rawStep = maximum / 5;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const step = (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude;
  return Math.ceil(maximum / step) * step;
}

export function classifyDeckQuadrant(
  point: Pick<DeckQuadrantPoint, "games" | "winRate">,
  thresholdGames: number,
  expectedWinRate: number,
): DeckQuadrantClassification {
  const highUsage = point.games >= thresholdGames;
  const aboveExpected = point.winRate > expectedWinRate;
  if (aboveExpected) return highUsage ? "proven-performer" : "promising";
  return highUsage ? "frequent-underperformer" : "underperforming-unproven";
}

export function rankOpponentDeckMatchups(
  rows: OpponentDeckMatchupStat[],
  { minimumSharedGames, mostFacedLimit = OPPONENT_DECK_MOST_FACED_LIST_SIZE }: {
    minimumSharedGames: number;
    mostFacedLimit?: number;
  },
): {
  mostFaced: OpponentDeckMatchupStat[];
  best: OpponentDeckMatchupStat[];
  toughest: OpponentDeckMatchupStat[];
} {
  const compareDeckName = (a: OpponentDeckMatchupStat, b: OpponentDeckMatchupStat) =>
    a.ownerName.localeCompare(b.ownerName) || a.name.localeCompare(b.name) || a.deckId.localeCompare(b.deckId);
  const mostFaced = [...rows].sort((a, b) =>
    b.sharedGames - a.sharedGames || compareDeckName(a, b));
  const eligible = rows.filter((row) => row.sharedGames >= minimumSharedGames);
  const best = [...eligible].sort((a, b) =>
    b.winRate - a.winRate || b.sharedGames - a.sharedGames || compareDeckName(a, b))
    .slice(0, OPPONENT_DECK_MATCHUP_LIST_SIZE);
  const bestIds = new Set(best.map((row) => row.deckId));
  const toughestCandidates = [...eligible].sort((a, b) =>
    a.winRate - b.winRate || b.sharedGames - a.sharedGames || compareDeckName(a, b));
  const toughest = (eligible.length >= OPPONENT_DECK_MATCHUP_LIST_SIZE * 2
    ? toughestCandidates.filter((row) => !bestIds.has(row.deckId))
    : toughestCandidates).slice(0, OPPONENT_DECK_MATCHUP_LIST_SIZE);
  return {
    mostFaced: mostFaced.slice(0, mostFacedLimit),
    best,
    toughest,
  };
}

function matchesPod(game: StatsGame, podFilter: PodFilter): boolean {
  if (podFilter === "3") return game.podSize === 3;
  if (podFilter === "4") return game.podSize === 4;
  return game.podSize >= 5;
}

function getGameEligibility(game: StatsGame) {
  return getEligibility(
    { podSize: game.podSize, result: game.result, winnerSeat: game.winningSeat },
    game.participants.map((participant) => ({ playerId: participant.playerId })),
  );
}

function compareGames(a: StatsGame, b: StatsGame): number {
  return a.playedOn.localeCompare(b.playedOn)
    || a.gameNumberOnDate - b.gameNumberOnDate
    || a.id.localeCompare(b.id);
}

function asRecentGame(game: StatsGame, seat: number): RecentProfileGame {
  const winEligible = getGameEligibility(game).winStatsEligible;
  return {
    game,
    outcome: !winEligible || game.result !== "single_winner" || game.winningSeat === null
      ? "Noncompetitive"
      : game.winningSeat === seat ? "Won" : "Lost",
  };
}

function getStreaks(games: Array<{ game: StatsGame; seat: number }>): StreakStats {
  let currentWins = 0;
  let currentLosses = 0;
  let longestWins = 0;
  let longestLosses = 0;
  for (const { game, seat } of games) {
    if (game.winningSeat === seat) {
      currentWins += 1;
      currentLosses = 0;
      longestWins = Math.max(longestWins, currentWins);
    } else {
      currentLosses += 1;
      currentWins = 0;
      longestLosses = Math.max(longestLosses, currentLosses);
    }
  }
  return { longestWins, longestLosses };
}

function makeSeats(
  games: StatsGame[],
  seatCount: number,
  participantMatch: (playerId: string | null, deckId: string | null) => boolean,
): SeatPerformance[] {
  const rows = Array.from({ length: seatCount }, (_, index) => ({ seat: index + 1, counts: emptyCounts() }));
  for (const game of games) {
    const eligibility = getGameEligibility(game);
    for (const participant of game.participants) {
      if (!participantMatch(participant.playerId, participant.deckId)) continue;
      const row = rows[participant.seat - 1];
      if (!row) continue;
      row.counts.recordedAppearances += 1;
      if (eligibility.participationEligible) row.counts.participationEligibleAppearances += 1;
      if (eligibility.winStatsEligible) {
        row.counts.winEligibleGames += 1;
        if (participant.seat === game.winningSeat) row.counts.wins += 1;
      }
    }
  }
  const totalAppearances = rows.reduce((sum, row) => sum + row.counts.participationEligibleAppearances, 0);
  return rows.map(({ seat, counts }) => ({
    seat,
    ...finishCounts(counts),
    appearanceShare: totalAppearances ? counts.participationEligibleAppearances / totalAppearances : 0,
  }));
}

function makeColorBreakdown(
  distinctDeckCounts: ReadonlyMap<string, number>,
  decksById: ReadonlyMap<string, ProfileDeck>,
  metadataById: CommanderMetadataById,
): ColorBreakdown {
  const colors = new Map<ColorIdentity, number>();
  let knownEntities = 0;
  let knownAppearances = 0;
  let totalAppearances = 0;
  for (const [deckId, appearances] of distinctDeckCounts) {
    totalAppearances += appearances;
    const deck = decksById.get(deckId);
    const metadata = deck ? metadataById.get(deck.commanderId) : undefined;
    if (!metadata || metadata.colors === null) continue;
    knownEntities += 1;
    knownAppearances += appearances;
    const identity = metadata.colors.length > 0 ? metadata.colors : ["C" as const];
    for (const color of identity) colors.set(color, (colors.get(color) ?? 0) + appearances);
  }
  const colorTotal = [...colors.values()].reduce((sum, count) => sum + count, 0);
  const orderedColors: ColorIdentity[] = ["W", "U", "B", "R", "G", "C"];
  return {
    rows: orderedColors
      .filter((color) => colors.has(color))
      .map((color) => ({ color, count: colors.get(color)!, share: colorTotal ? colors.get(color)! / colorTotal : 0 })),
    knownEntities,
    totalEntities: distinctDeckCounts.size,
    unknownEntities: distinctDeckCounts.size - knownEntities,
    knownAppearances,
    totalAppearances,
    unknownAppearances: totalAppearances - knownAppearances,
  };
}

function getMaxSeat(games: StatsGame[]): number {
  return games.reduce((max, game) => Math.max(max, game.podSize), 0);
}

function getRankings<T extends { id: string; winEligibleGames: number; winRate: number | null }>(rows: T[]): Map<string, number> {
  return new Map(rows
    .filter((row) => row.winEligibleGames >= PLAYER_COMPARISON_MINIMUM_GAMES && row.winRate !== null)
    .sort((a, b) => (b.winRate ?? -1) - (a.winRate ?? -1) || b.winEligibleGames - a.winEligibleGames || a.id.localeCompare(b.id))
    .map((row, index) => [row.id, index + 1]));
}

export function buildProfileStatistics(
  sourceGames: StatsGame[],
  registeredPlayers: StatsPlayer[],
  registeredDecks: ProfileDeck[],
  podFilter: PodFilter = "4",
  metadataById: CommanderMetadataById = new Map(),
  eloConfig: Readonly<ProvisionalEloConfig> = DEFAULT_PROVISIONAL_ELO_CONFIG,
): ProfileStatistics {
  const podGames = sourceGames.filter((game) => matchesPod(game, podFilter)).sort(compareGames);
  const participationGames = podGames.filter((game) => getGameEligibility(game).participationEligible);
  const winGames = podGames.filter((game) => getGameEligibility(game).winStatsEligible);
  const fourPlayerGames = podGames.filter((game) => getGameEligibility(game).officialFourPlayerWinStatsEligible);
  const playerEloHistory = calculateEloHistory(winGames, "player", eloConfig);
  const deckEloHistory = calculateEloHistory(winGames, "deck", eloConfig);
  const playersById = new Map(registeredPlayers.map((player) => [player.id, player]));
  const deckCatalog = new Map(registeredDecks.map((deck) => [deck.id, deck]));
  const maximumSeat = getMaxSeat(podGames);

  const playerParticipation = new Map<string, number>();
  const deckRecordedCounts = new Map<string, number>();
  const deckParticipation = new Map<string, number>();
  const deckWinCounts = new Map<string, { games: number; wins: number }>();
  for (const game of podGames) {
    const eligibility = getGameEligibility(game);
    for (const participant of game.participants) {
      if (participant.playerId) {
        playerParticipation.set(participant.playerId, (playerParticipation.get(participant.playerId) ?? 0) + Number(eligibility.participationEligible));
      }
      if (!participant.deckId) continue;
      deckRecordedCounts.set(participant.deckId, (deckRecordedCounts.get(participant.deckId) ?? 0) + 1);
      if (eligibility.participationEligible) deckParticipation.set(participant.deckId, (deckParticipation.get(participant.deckId) ?? 0) + 1);
      if (eligibility.winStatsEligible) {
        const counts = deckWinCounts.get(participant.deckId) ?? { games: 0, wins: 0 };
        counts.games += 1;
        if (participant.seat === game.winningSeat) counts.wins += 1;
        deckWinCounts.set(participant.deckId, counts);
      }
    }
  }

  const deckRows: DeckPerformance[] = registeredDecks.map((deck) => {
    const winCounts = deckWinCounts.get(deck.id) ?? { games: 0, wins: 0 };
    return {
      id: deck.id,
      ownerId: deck.ownerId,
      ownerName: deck.ownerName,
      name: deck.name,
      commanderId: deck.commanderId,
      commanderName: deck.commanderName,
      moxfieldUrl: deck.moxfieldUrl,
      recordedAppearances: deckRecordedCounts.get(deck.id) ?? 0,
      participationEligibleAppearances: deckParticipation.get(deck.id) ?? 0,
      winEligibleGames: winCounts.games,
      wins: winCounts.wins,
      winRate: winCounts.games ? winCounts.wins / winCounts.games : null,
      elo: deckEloHistory.ratings.has(deck.id) ? Math.round(deckEloHistory.ratings.get(deck.id)!) : null,
      eloGames: deckEloHistory.games.get(deck.id) ?? 0,
      rank: null,
    };
  });
  const deckRanks = new Map(deckRows
    .filter((deck) => deck.winEligibleGames >= DECK_RANKING_MINIMUM_GAMES && deck.winRate !== null)
    .sort((a, b) => (b.winRate ?? -1) - (a.winRate ?? -1) || b.winEligibleGames - a.winEligibleGames || a.id.localeCompare(b.id))
    .map((deck, index) => [deck.id, index + 1]));
  for (const deck of deckRows) deck.rank = deckRanks.get(deck.id) ?? null;

  const playerRowsWithoutRank = registeredPlayers.map((player) => {
    const recordedGames = podGames.filter((game) => game.participants.some((participant) => participant.playerId === player.id));
    const participatingGames = participationGames.filter((game) => game.participants.some((participant) => participant.playerId === player.id));
    const eligibleGames = winGames.filter((game) => game.participants.some((participant) => participant.playerId === player.id));
    const wins = eligibleGames.filter((game) => game.winningSeat !== null && game.participants.some((participant) => participant.playerId === player.id && participant.seat === game.winningSeat)).length;
    return {
      player,
      recordedGames,
      participatingGames,
      eligibleGames,
      totals: {
        recordedAppearances: recordedGames.length,
        participationEligibleAppearances: participatingGames.length,
        winEligibleGames: eligibleGames.length,
        wins,
        winRate: eligibleGames.length ? wins / eligibleGames.length : null,
      },
    };
  });
  const playerRanks = getRankings(playerRowsWithoutRank.map(({ player, totals }) => ({ id: player.id, ...totals })));
  const playerSharedMatchups = calculatePlayerSharedMatchups(winGames, registeredPlayers);

  const playerStats = new Map<string, PlayerProfileStats>();
  for (const { player, recordedGames, participatingGames, eligibleGames, totals } of playerRowsWithoutRank) {
    const elo = playerEloHistory.ratings.get(player.id);
    const eloHistory = playerEloHistory.history.get(player.id) ?? [];
    const playerHistory = eligibleGames.map((game) => {
      const seat = game.participants.find((participant) => participant.playerId === player.id)!.seat;
      return { game, seat };
    });
    const trends: ProfileTrendPoint[] = [];
    let cumulativeWins = 0;
    for (const [index, { game, seat }] of playerHistory.entries()) {
      if (seat === game.winningSeat) cumulativeWins += 1;
      const point = [...eloHistory].reverse().find((entry) => entry.gameId === game.id);
      trends.push({
        gameId: game.id,
        playedOn: game.playedOn,
        gameNumberOnDate: game.gameNumberOnDate,
        rating: point?.rating ?? elo ?? 1000,
        games: index + 1,
        wins: cumulativeWins,
        winRate: cumulativeWins / (index + 1),
      });
    }

    const deckCountsForPlayer = new Map<string, number>();
    for (const game of participatingGames) {
      const participant = game.participants.find((entry) => entry.playerId === player.id);
      if (participant?.deckId) deckCountsForPlayer.set(participant.deckId, (deckCountsForPlayer.get(participant.deckId) ?? 0) + 1);
    }
    const playedDecks = [...deckCountsForPlayer.keys()].map((id) => deckCatalog.get(id)).filter((deck): deck is ProfileDeck => Boolean(deck));
    const playerDeckStats = deckRows.filter((deck) => deck.ownerId === player.id).sort((a, b) =>
      b.participationEligibleAppearances - a.participationEligibleAppearances || a.name.localeCompare(b.name));
    const deckColorWeights = new Map(playedDecks.map((deck) => [deck.id, 1]));
    const gameColorWeights = new Map(deckCountsForPlayer);
    const opponentDeckCounts = new Map<string, { sharedGames: number; wins: number; gameIds: string[] }>();
    for (const game of eligibleGames) {
      const self = game.participants.find((participant) => participant.playerId === player.id);
      if (!self) continue;
      const playerWon = self.seat === game.winningSeat;
      const seenOpponentDecks = new Set<string>();
      for (const opponent of game.participants) {
        if (!opponent.deckId || seenOpponentDecks.has(opponent.deckId)) continue;
        const opponentDeck = deckCatalog.get(opponent.deckId);
        if (!opponentDeck || opponentDeck.ownerId === player.id) continue;
        seenOpponentDecks.add(opponent.deckId);
        const counts = opponentDeckCounts.get(opponent.deckId) ?? { sharedGames: 0, wins: 0, gameIds: [] };
        counts.sharedGames += 1;
        if (playerWon) counts.wins += 1;
        counts.gameIds.push(game.id);
        opponentDeckCounts.set(opponent.deckId, counts);
      }
    }
    const opponentRows = playerSharedMatchups.filter((row) => row.playerId === player.id).map((row) => ({
      playerId: row.opponentId,
      name: row.opponentName,
      sharedGames: row.sharedGames,
      wins: row.wins,
      winRate: row.winRate,
    })).sort((a, b) => b.sharedGames - a.sharedGames || a.name.localeCompare(b.name));
    const opponentDeckRows: OpponentDeckMatchupStat[] = [...opponentDeckCounts.entries()].flatMap(([deckId, counts]) => {
      const deck = deckCatalog.get(deckId);
      if (!deck) return [];
      return [{
        deckId,
        ownerId: deck.ownerId,
        ownerName: deck.ownerName,
        name: deck.name,
        commanderName: deck.commanderName,
        sharedGames: counts.sharedGames,
        wins: counts.wins,
        winRate: counts.wins / counts.sharedGames,
        gameIds: counts.gameIds,
      }];
    });
    const matchupRankings = rankOpponentDeckMatchups(opponentDeckRows, {
      minimumSharedGames: PLAYER_OPPONENT_DECK_MATCHUP_MINIMUM_GAMES,
    });
    const seats = makeSeats(podGames, maximumSeat, (candidateId) => candidateId === player.id);
    const appearancesBySeat = seats.reduce((sum, seat) => sum + seat.participationEligibleAppearances, 0);
    const adjustedSeats = seats.map((seat) => ({ ...seat, appearanceShare: appearancesBySeat ? seat.participationEligibleAppearances / appearancesBySeat : 0 }));
    const playerRecentGames = recordedGames.slice(-8).reverse().map((game) => {
      const seat = game.participants.find((participant) => participant.playerId === player.id)!.seat;
      return asRecentGame(game, seat);
    });
    const careerElo = eloHistory.map((point) => point.rating);
    const mostPlayedDeckId = [...deckCountsForPlayer.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];

    playerStats.set(player.id, {
      player,
      podFilter,
      totalGamesInPod: podGames.length,
      totals,
      expectedWinRate: eligibleGames.length ? eligibleGames.reduce((sum, game) => sum + 1 / game.podSize, 0) / eligibleGames.length : null,
      elo: elo === undefined ? null : Math.round(elo),
      eloGames: playerEloHistory.games.get(player.id) ?? 0,
      competitiveRank: playerRanks.get(player.id) ?? null,
      meetsComparisonMinimum: totals.winEligibleGames >= PLAYER_COMPARISON_MINIMUM_GAMES,
      distinctDecksPlayed: playedDecks.length,
      mostPlayedDeck: mostPlayedDeckId ? deckCatalog.get(mostPlayedDeckId) ?? null : null,
      decks: playerDeckStats,
      seats: adjustedSeats,
      colorsByDeck: makeColorBreakdown(deckColorWeights, deckCatalog, metadataById),
      colorsByGame: makeColorBreakdown(gameColorWeights, deckCatalog, metadataById),
      trends,
      opponents: opponentRows,
      mostFacedDecks: matchupRankings.mostFaced,
      bestMatchups: matchupRankings.best,
      toughestMatchups: matchupRankings.toughest,
      streaks: getStreaks(playerHistory),
      peakElo: careerElo.length ? Math.round(Math.max(...careerElo)) : null,
      minimumElo: careerElo.length ? Math.round(Math.min(...careerElo)) : null,
      recentGames: playerRecentGames,
    });
  }

  const deckStats = new Map(deckRows.map((deck) => [deck.id, deck]));
  const deckProfiles = new Map<string, DeckProfileStats>();
  const expectedTotals = winGames.reduce((sum, game) => {
    const ownedDeckAppearances = game.participants.filter((participant) => participant.deckId !== null).length;
    return sum + ownedDeckAppearances / game.podSize;
  }, 0);
  const deckAppearanceTotal = winGames.reduce((sum, game) => sum + game.participants.filter((participant) => participant.deckId !== null).length, 0);
  const quadrantExpectedWinRate = deckAppearanceTotal ? expectedTotals / deckAppearanceTotal : null;
  const rankedDecks = deckRows.filter((deck) => deck.winEligibleGames > 0 && deck.winRate !== null);
  const quadrantPoints: DeckQuadrantPoint[] = rankedDecks.map((deck) => ({
    deckId: deck.id,
    ownerId: deck.ownerId,
    ownerName: deck.ownerName,
    name: deck.name,
    games: deck.winEligibleGames,
    wins: deck.wins,
    winRate: deck.winRate!,
    elo: deck.elo,
  }));
  const quadrantThreshold = getDeckQuadrantThreshold(quadrantPoints, podFilter);
  for (const deck of registeredDecks) {
    const recordedGames = podGames.filter((game) => game.participants.some((participant) => participant.deckId === deck.id));
    const eligibleGames = winGames.filter((game) => game.participants.some((participant) => participant.deckId === deck.id));
    const trend: ProfileTrendPoint[] = [];
    let cumulativeWins = 0;
    for (const [index, game] of eligibleGames.entries()) {
      const self = game.participants.find((participant) => participant.deckId === deck.id)!;
      if (self.seat === game.winningSeat) cumulativeWins += 1;
      const eloPoint = (deckEloHistory.history.get(deck.id) ?? []).find((point) => point.gameId === game.id);
      trend.push({
        gameId: game.id,
        playedOn: game.playedOn,
        gameNumberOnDate: game.gameNumberOnDate,
        rating: eloPoint?.rating ?? deckEloHistory.ratings.get(deck.id) ?? 1000,
        games: index + 1,
        wins: cumulativeWins,
        winRate: cumulativeWins / (index + 1),
      });
    }
    const counts = deckStats.get(deck.id)!;
    const owner = playersById.get(deck.ownerId) ?? null;
    const seats = makeSeats(podGames, maximumSeat, (_playerId, deckId) => deckId === deck.id);
    const totalSeatAppearances = seats.reduce((sum, seat) => sum + seat.participationEligibleAppearances, 0);
    const opponentDeckRows = calculateDeckOpponentMatchups(deck.id, eligibleGames, deckCatalog);
    const matchupRankings = rankOpponentDeckMatchups(opponentDeckRows, {
      minimumSharedGames: DECK_OPPONENT_DECK_MATCHUP_MINIMUM_GAMES,
      mostFacedLimit: 5,
    });
    const history = deckEloHistory.history.get(deck.id) ?? [];
    const ratings = history.map((point) => point.rating);
    const recentGames = recordedGames.slice(-8).reverse().map((game) => {
      const participant = game.participants.find((entry) => entry.deckId === deck.id)!;
      return asRecentGame(game, participant.seat);
    });
    deckProfiles.set(deck.id, {
      deck,
      owner,
      podFilter,
      totalGamesInPod: podGames.length,
      totals: counts,
      elo: counts.elo,
      eloGames: counts.eloGames,
      meetsRankingMinimum: counts.winEligibleGames >= DECK_RANKING_MINIMUM_GAMES,
      commanderMetadata: metadataById.get(deck.commanderId) ?? { colors: null, artUrl: null },
      seats: seats.map((seat) => ({ ...seat, appearanceShare: totalSeatAppearances ? seat.participationEligibleAppearances / totalSeatAppearances : 0 })),
      trends: trend,
      streaks: getStreaks(eligibleGames.map((game) => ({ game, seat: game.participants.find((participant) => participant.deckId === deck.id)!.seat }))),
      peakElo: ratings.length ? Math.round(Math.max(...ratings)) : null,
      minimumElo: ratings.length ? Math.round(Math.min(...ratings)) : null,
      mostFacedDecks: matchupRankings.mostFaced,
      bestMatchups: matchupRankings.best,
      toughestMatchups: matchupRankings.toughest,
      quadrantPoints,
      quadrantThreshold,
      quadrantExpectedWinRate,
      recentGames,
    });
  }

  return {
    podFilter,
    totalGamesInPod: podGames.length,
    participationEligibleGames: participationGames.length,
    winEligibleGames: winGames.length,
    officialFourPlayerGames: fourPlayerGames.length,
    players: playerStats,
    deckDirectory: deckRows,
    decks: deckProfiles,
  };
}
