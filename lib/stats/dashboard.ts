import { getEligibility, type HistoricalResult } from "../historical/model.ts";

export type DashboardRange = "all" | "365" | "30";

export interface StatsParticipant {
  seat: number;
  playerId: string | null;
  playerName: string;
  deckId: string | null;
  deckName: string | null;
  commanderId?: string;
  commanderName: string;
  isWinner?: boolean;
}

export interface StatsGame {
  id: string;
  playedOn: string;
  gameNumberOnDate: number;
  podSize: number;
  result: HistoricalResult;
  winningSeat: number | null;
  participants: StatsParticipant[];
}

export interface StatsPlayer {
  id: string;
  name: string;
  moxfieldUrl?: string | null;
}

export interface DashboardWindow {
  range: DashboardRange;
  startDate: string | null;
  endDate: string;
}

export interface PlayerStat extends StatsPlayer {
  games: number;
  wins: number;
  winRate: number | null;
  elo: number | null;
  eloGames: number;
}

export interface DeckStat {
  id: string;
  ownerId: string;
  ownerName: string;
  name: string;
  commanderName: string;
  games: number;
  wins: number;
  winRate: number;
  elo: number | null;
  eloGames: number;
}

export interface CumulativePoint {
  date: string;
  games: number;
  uniqueDecks: number;
  gamesOnDate: number;
}

export interface RecentGameStat {
  id: string;
  playedOn: string;
  gameNumberOnDate: number;
  winnerName: string;
  winnerCommander: string;
  memberNames: string[];
  guestSeats: number[];
  participantCount: number;
}

export interface DashboardStats {
  window: DashboardWindow;
  eligibleHistoryCount: number;
  activePlayers: number;
  gamesPlayed: number;
  uniqueDecksPlayed: number;
  playersByWinRate: PlayerStat[];
  playerLeaderboard: PlayerStat[];
  playerEloRankings: PlayerStat[];
  topDecksByWinRate: DeckStat[];
  topDecksByElo: DeckStat[];
  deckDiversity: Array<{ ownerId: string; ownerName: string; deckCount: number; share: number }>;
  cumulative: CumulativePoint[];
  recentGames: RecentGameStat[];
  hotPlayers: Array<{ id: string; name: string; games: number; wins: number; winRate: number }>;
  coldPlayers: Array<{ id: string; name: string; games: number; wins: number; winRate: number }>;
  hotColdWindowGames: number;
}

export interface ProvisionalEloConfig {
  startingRating: number;
  kFactor: number;
  seatOrderAdjustmentPerPosition: number;
  minimumSeatFactor: number;
  maximumSeatFactor: number;
}

/** Defaults from the approved provisional formula; override only for simulations. */
export const DEFAULT_PROVISIONAL_ELO_CONFIG: Readonly<ProvisionalEloConfig> = Object.freeze({
  startingRating: 1000,
  kFactor: 24,
  seatOrderAdjustmentPerPosition: 0.03,
  minimumSeatFactor: 0.9,
  maximumSeatFactor: 1.1,
});

export const DASHBOARD_MINIMUM_PLAYER_GAMES = 10;
const MINIMUM_DECK_RANKING_GAMES = 5;

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Returns the local calendar date for the configured site timezone. */
export function getSiteToday(now = new Date(), timeZone = "America/Chicago"): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

/** Rolling windows include the local end date: 365 or 30 calendar dates total. */
export function getDashboardWindow(range: DashboardRange, today: string): DashboardWindow {
  const days = range === "365" ? 365 : range === "30" ? 30 : null;
  return {
    range,
    startDate: days ? addDays(today, -(days - 1)) : null,
    endDate: today,
  };
}

function compareGames(a: StatsGame, b: StatsGame): number {
  return a.playedOn.localeCompare(b.playedOn)
    || a.gameNumberOnDate - b.gameNumberOnDate
    || a.id.localeCompare(b.id);
}

function isFourPlayerWinEligible(game: StatsGame): boolean {
  const eligibility = getEligibility(
    { podSize: game.podSize, result: game.result, winnerSeat: game.winningSeat },
    game.participants.map((participant) => ({ playerId: participant.playerId })),
  );
  return eligibility.officialFourPlayerWinStatsEligible;
}

/**
 * Provisional multiplayer Elo used by the Dashboard. Each guest seat is a
 * temporary neutral 1000-rated opponent; only member identities are retained.
 * A positive winner gain gets the documented seat factor and the added points
 * are taken evenly from the other seats so every game remains zero-sum.
 */
export function calculateMultiplayerEloDeltas(
  ratings: number[],
  winnerSeat: number,
  config: Readonly<ProvisionalEloConfig> = DEFAULT_PROVISIONAL_ELO_CONFIG,
): number[] {
  const podSize = ratings.length;
  if (podSize < 2 || !Number.isInteger(winnerSeat) || winnerSeat < 1 || winnerSeat > podSize) {
    throw new Error("Elo needs at least two seat ratings and a valid winning seat.");
  }

  const deltas = ratings.map((rating, index) => {
    const seat = index + 1;
    let pairwiseResult = 0;
    for (let opponentIndex = 0; opponentIndex < podSize; opponentIndex += 1) {
      if (opponentIndex === index) continue;
      const opponentSeat = opponentIndex + 1;
      const opponentWon = opponentSeat === winnerSeat;
      const seatWon = seat === winnerSeat;
      const score = seatWon ? 1 : opponentWon ? 0 : 0.5;
      const expectation = 1 / (1 + 10 ** ((ratings[opponentIndex] - rating) / 400));
      pairwiseResult += score - expectation;
    }
    return (config.kFactor / (podSize - 1)) * pairwiseResult;
  });

  const winnerIndex = winnerSeat - 1;
  if (deltas[winnerIndex] > 0) {
    const seatFactor = Math.max(
      config.minimumSeatFactor,
      Math.min(
        config.maximumSeatFactor,
        1 + config.seatOrderAdjustmentPerPosition * (winnerSeat - (podSize + 1) / 2),
      ),
    );
    const redistributed = deltas[winnerIndex] * (seatFactor - 1);
    deltas[winnerIndex] += redistributed;
    for (let index = 0; index < podSize; index += 1) {
      if (index !== winnerIndex) deltas[index] -= redistributed / (podSize - 1);
    }
  }
  return deltas;
}

interface EloResult {
  ratings: Map<string, number>;
  games: Map<string, number>;
}

export interface EloHistoryPoint {
  gameId: string;
  playedOn: string;
  gameNumberOnDate: number;
  rating: number;
  games: number;
}

export interface EloHistoryResult extends EloResult {
  history: Map<string, EloHistoryPoint[]>;
}

/** Shared chronological Elo engine used by Dashboard and profile time series. */
export function calculateEloHistory(
  games: StatsGame[],
  identity: "player" | "deck",
  config: Readonly<ProvisionalEloConfig> = DEFAULT_PROVISIONAL_ELO_CONFIG,
): EloHistoryResult {
  const ratings = new Map<string, number>();
  const appearances = new Map<string, number>();
  const history = new Map<string, EloHistoryPoint[]>();
  for (const game of [...games].sort(compareGames)) {
    const eligibility = getEligibility(
      { podSize: game.podSize, result: game.result, winnerSeat: game.winningSeat },
      game.participants.map((participant) => ({ playerId: participant.playerId })),
    );
    if (!eligibility.winStatsEligible) continue;
    const winner = game.participants.find((participant) => participant.seat === game.winningSeat);
    if (!winner) continue;
    const ids = game.participants.map((participant) => identity === "player" ? participant.playerId : participant.deckId);
    const seatRatings = ids.map((id) => id ? ratings.get(id) ?? config.startingRating : config.startingRating);
    const deltas = calculateMultiplayerEloDeltas(seatRatings, winner.seat, config);
    const updates = new Map<string, number>();
    for (let index = 0; index < ids.length; index += 1) {
      const id = ids[index];
      if (!id) continue;
      updates.set(id, (updates.get(id) ?? 0) + deltas[index]);
      const gamesPlayed = (appearances.get(id) ?? 0) + 1;
      appearances.set(id, gamesPlayed);
    }
    for (const [id, delta] of updates) {
      const rating = (ratings.get(id) ?? config.startingRating) + delta;
      ratings.set(id, rating);
      const points = history.get(id) ?? [];
      points.push({
        gameId: game.id,
        playedOn: game.playedOn,
        gameNumberOnDate: game.gameNumberOnDate,
        rating,
        games: appearances.get(id) ?? 0,
      });
      history.set(id, points);
    }
  }
  return { ratings, games: appearances, history };
}

function calculateElo(
  games: StatsGame[],
  identity: "player" | "deck",
  config: Readonly<ProvisionalEloConfig>,
): EloResult {
  const result = calculateEloHistory(games, identity, config);
  return { ratings: result.ratings, games: result.games };
}

function createRecentGame(game: StatsGame, playerNames: Map<string, string>): RecentGameStat | null {
  const winner = game.participants.find((participant) => participant.seat === game.winningSeat);
  if (!winner) return null;
  const guestSeats = game.participants.filter((participant) => participant.playerId === null).map((participant) => participant.seat);
  const memberNames = game.participants
    .filter((participant) => participant.playerId !== null)
    .map((participant) => playerNames.get(participant.playerId!) ?? participant.playerName)
    .filter((name, index, list) => list.indexOf(name) === index);
  return {
    id: game.id,
    playedOn: game.playedOn,
    gameNumberOnDate: game.gameNumberOnDate,
    winnerName: winner.playerId ? playerNames.get(winner.playerId) ?? winner.playerName : `Guest (Seat ${winner.seat})`,
    winnerCommander: winner.commanderName,
    memberNames,
    guestSeats,
    participantCount: game.participants.length,
  };
}

/**
 * Calculates every Dashboard panel from one eligible four-player cohort.
 * Date-window rates, counts and charts all use the same period cohort. Elo is
 * recalculated from eligible history through the window end, so it never resets
 * to 1000 at the start of a shorter period.
 */
export function buildDashboardStats(
  sourceGames: StatsGame[],
  registeredPlayers: StatsPlayer[],
  range: DashboardRange,
  today: string,
  eloConfig: Readonly<ProvisionalEloConfig> = DEFAULT_PROVISIONAL_ELO_CONFIG,
): DashboardStats {
  const window = getDashboardWindow(range, today);
  const allEligibleThroughEnd = sourceGames
    .filter((game) => game.playedOn <= window.endDate && isFourPlayerWinEligible(game))
    .sort(compareGames);
  const periodGames = allEligibleThroughEnd.filter((game) => !window.startDate || game.playedOn >= window.startDate);
  const playerNames = new Map(registeredPlayers.map((player) => [player.id, player.name]));

  const playerCounts = new Map<string, { games: number; wins: number }>();
  const deckCounts = new Map<string, { ownerId: string; ownerName: string; name: string; commanderName: string; games: number; wins: number }>();
  const distinctDecksByOwner = new Map<string, Set<string>>();
  const gamesByDate = new Map<string, number>();
  const cumulative: CumulativePoint[] = [];

  for (const game of periodGames) {
    gamesByDate.set(game.playedOn, (gamesByDate.get(game.playedOn) ?? 0) + 1);
    for (const participant of game.participants) {
      if (participant.playerId) {
        const current = playerCounts.get(participant.playerId) ?? { games: 0, wins: 0 };
        current.games += 1;
        if (participant.seat === game.winningSeat) current.wins += 1;
        playerCounts.set(participant.playerId, current);
      }
      if (participant.playerId && participant.deckId) {
        const ownerName = playerNames.get(participant.playerId) ?? participant.playerName;
        const entry = deckCounts.get(participant.deckId) ?? {
          ownerId: participant.playerId,
          ownerName,
          name: participant.deckName?.trim() || participant.commanderName,
          commanderName: participant.commanderName,
          games: 0,
          wins: 0,
        };
        entry.games += 1;
        if (participant.seat === game.winningSeat) entry.wins += 1;
        deckCounts.set(participant.deckId, entry);
        const ownerDecks = distinctDecksByOwner.get(participant.playerId) ?? new Set<string>();
        ownerDecks.add(participant.deckId);
        distinctDecksByOwner.set(participant.playerId, ownerDecks);
      }
    }
  }

  let runningGames = 0;
  const cumulativeDecks = new Set<string>();
  for (const [date, gamesOnDate] of [...gamesByDate.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    runningGames += gamesOnDate;
    for (const game of periodGames) {
      if (game.playedOn !== date) continue;
      for (const participant of game.participants) {
        if (participant.playerId && participant.deckId) cumulativeDecks.add(participant.deckId);
      }
    }
    cumulative.push({ date, games: runningGames, uniqueDecks: cumulativeDecks.size, gamesOnDate });
  }

  const playerElo = calculateElo(allEligibleThroughEnd, "player", eloConfig);
  const deckElo = calculateElo(allEligibleThroughEnd, "deck", eloConfig);
  const activePlayerRows: PlayerStat[] = [...playerCounts.entries()].map(([id, counts]) => {
    const player = registeredPlayers.find((candidate) => candidate.id === id);
    const elo = playerElo.ratings.get(id);
    return {
      id,
      name: player?.name ?? id,
      games: counts.games,
      wins: counts.wins,
      winRate: counts.games > 0 ? counts.wins / counts.games : null,
      elo: elo === undefined ? null : Math.round(elo),
      eloGames: playerElo.games.get(id) ?? 0,
    };
  });
  const playersByWinRate = [...activePlayerRows]
    .filter((player) => player.games >= DASHBOARD_MINIMUM_PLAYER_GAMES)
    .sort((a, b) => (b.winRate ?? -1) - (a.winRate ?? -1) || b.games - a.games || a.name.localeCompare(b.name));
  const playerLeaderboard = [...activePlayerRows].sort((a, b) => b.games - a.games || b.wins - a.wins || a.name.localeCompare(b.name));
  const playerEloRankings = [...activePlayerRows]
    .filter((player) => player.elo !== null && player.games >= DASHBOARD_MINIMUM_PLAYER_GAMES)
    .sort((a, b) => (b.elo ?? 0) - (a.elo ?? 0) || a.name.localeCompare(b.name));

  const deckRows: DeckStat[] = [...deckCounts.entries()].map(([id, deck]) => ({
    id,
    ...deck,
    winRate: deck.wins / deck.games,
    elo: deckElo.ratings.has(id) ? Math.round(deckElo.ratings.get(id)!) : null,
    eloGames: deckElo.games.get(id) ?? 0,
  }));
  const qualifiedDecks = deckRows.filter((deck) => deck.games >= MINIMUM_DECK_RANKING_GAMES);
  const topDecksByWinRate = [...qualifiedDecks]
    .sort((a, b) => b.winRate - a.winRate || b.games - a.games || a.name.localeCompare(b.name))
    .slice(0, 5);
  const topDecksByElo = [...qualifiedDecks]
    .filter((deck) => deck.elo !== null)
    .sort((a, b) => (b.elo ?? 0) - (a.elo ?? 0) || b.games - a.games || a.name.localeCompare(b.name))
    .slice(0, 5);

  const uniqueDeckCount = deckCounts.size;
  const deckDiversity = [...distinctDecksByOwner.entries()]
    .map(([ownerId, deckIds]) => ({
      ownerId,
      ownerName: playerNames.get(ownerId) ?? ownerId,
      deckCount: deckIds.size,
      share: uniqueDeckCount ? deckIds.size / uniqueDeckCount : 0,
    }))
    .sort((a, b) => b.deckCount - a.deckCount || a.ownerName.localeCompare(b.ownerName));

  const lastFive = periodGames.slice(-5);
  const qualifiedPlayerIds = new Set(
    activePlayerRows
      .filter((player) => player.games >= DASHBOARD_MINIMUM_PLAYER_GAMES)
      .map((player) => player.id),
  );
  const shortWindowCounts = new Map<string, { games: number; wins: number }>();
  for (const game of lastFive) {
    for (const participant of game.participants) {
      if (!participant.playerId) continue;
      const current = shortWindowCounts.get(participant.playerId) ?? { games: 0, wins: 0 };
      current.games += 1;
      if (participant.seat === game.winningSeat) current.wins += 1;
      shortWindowCounts.set(participant.playerId, current);
    }
  }
  const recentPerformers = [...shortWindowCounts.entries()]
    .filter(([id, counts]) => qualifiedPlayerIds.has(id) && counts.games >= 2)
    .map(([id, counts]) => ({
      id,
      name: playerNames.get(id) ?? id,
      games: counts.games,
      wins: counts.wins,
      winRate: counts.wins / counts.games,
    }));
  const highestRecentRate = recentPerformers.length ? Math.max(...recentPerformers.map((player) => player.winRate)) : null;
  const lowestRecentRate = recentPerformers.length ? Math.min(...recentPerformers.map((player) => player.winRate)) : null;
  const hotPlayers = highestRecentRate === null ? [] : recentPerformers
    .filter((player) => player.winRate === highestRecentRate)
    .sort((a, b) => a.name.localeCompare(b.name));
  const coldPlayers = lowestRecentRate === null ? [] : recentPerformers
    .filter((player) => player.winRate === lowestRecentRate)
    .sort((a, b) => a.name.localeCompare(b.name));

  const recentGames = [...periodGames].reverse().slice(0, 3)
    .map((game) => createRecentGame(game, playerNames))
    .filter((game): game is RecentGameStat => game !== null);

  return {
    window,
    eligibleHistoryCount: allEligibleThroughEnd.length,
    activePlayers: activePlayerRows.length,
    gamesPlayed: periodGames.length,
    uniqueDecksPlayed: uniqueDeckCount,
    playersByWinRate,
    playerLeaderboard,
    playerEloRankings,
    topDecksByWinRate,
    topDecksByElo,
    deckDiversity,
    cumulative,
    recentGames,
    hotPlayers,
    coldPlayers,
    hotColdWindowGames: lastFive.length,
  };
}

