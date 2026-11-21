export type HistoricalResult = "single_winner" | "draw" | "shared_winner" | "winner_missing";
export type HistoricalDateOrigin = "Explicit" | "Carried forward";

export interface HistoricalGame {
  gameId: string;
  sourceGameKey: string;
  playedOn: string;
  dateOrigin: HistoricalDateOrigin;
  podSize: number;
  memberCount: number;
  result: HistoricalResult;
  winnerSeat: number | null;
  analyticsEligible: boolean;
  winStatsEligible: boolean;
  officialFourPlayerWinStatsEligible: boolean;
}

export interface HistoricalSeat {
  gameId: string;
  sourceGameKey: string;
  seat: number;
  playerId: string | null;
  deckId: string | null;
  commanderId: string;
  displayPlayer: string;
  isWinner: boolean;
}

export interface Eligibility {
  memberCount: number;
  participationEligible: boolean;
  winStatsEligible: boolean;
  officialFourPlayerWinStatsEligible: boolean;
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

/** Single source of truth for the approved 2+ member, single-winner and 4-player gates. */
export function getEligibility(game: Pick<HistoricalGame, "podSize" | "result" | "winnerSeat">, seats: Pick<HistoricalSeat, "playerId">[]): Eligibility {
  const memberCount = seats.filter((seat) => seat.playerId !== null).length;
  const participationEligible = memberCount >= 2;
  const winStatsEligible = participationEligible && game.result === "single_winner" && game.winnerSeat !== null;
  return {
    memberCount,
    participationEligible,
    winStatsEligible,
    officialFourPlayerWinStatsEligible: winStatsEligible && game.podSize === 4,
  };
}

export interface ManualSeatInput {
  seat: number;
  isGuest: boolean;
  playerId: string | null;
  deckId: string | null;
  commanderId: string | null;
}

export interface ManualDeckRef {
  deckId: string;
  playerId: string;
  commanderId: string;
}

export interface ManualGameInput {
  podSize: number;
  seats: ManualSeatInput[];
  decks: ManualDeckRef[];
  winnerSeat: number | null;
}

/** New manually entered games are stricter than the historical import exceptions. */
export function validateManualGame(input: ManualGameInput): string[] {
  const errors: string[] = [];
  if (!Number.isInteger(input.podSize) || input.podSize < 3 || input.podSize > 6) errors.push("Pod size must be between 3 and 6.");
  if (input.seats.length !== input.podSize) errors.push("The seat count must match the pod size.");

  const seatNumbers = input.seats.map((seat) => seat.seat);
  if (new Set(seatNumbers).size !== seatNumbers.length) errors.push("Seat numbers must be unique.");
  if (Number.isInteger(input.podSize) && input.podSize >= 1) {
    const expected = Array.from({ length: input.podSize }, (_, index) => index + 1);
    if (expected.some((seat) => !seatNumbers.includes(seat))) errors.push("Seats must be contiguous from 1 through the pod size.");
  }

  const memberIds = input.seats.filter((seat) => !seat.isGuest).map((seat) => seat.playerId).filter((id): id is string => id !== null);
  if (new Set(memberIds).size !== memberIds.length) errors.push("A member can appear only once in a game.");
  const deckMap = new Map(input.decks.map((deck) => [deck.deckId, deck]));

  for (const seat of input.seats) {
    if (!Number.isInteger(seat.seat) || seat.seat < 1 || seat.seat > input.podSize) errors.push(`Seat ${seat.seat} is outside the pod.`);
    if (!seat.commanderId) errors.push(`Seat ${seat.seat} needs a commander.`);
    if (seat.isGuest) {
      if (seat.playerId !== null || seat.deckId !== null) errors.push(`Guest seat ${seat.seat} cannot have a member or deck ID.`);
    } else {
      if (!seat.playerId) errors.push(`Member seat ${seat.seat} needs a player ID.`);
      if (!seat.deckId) {
        errors.push(`Member seat ${seat.seat} needs an owned deck ID.`);
      } else {
        const deck = deckMap.get(seat.deckId);
        if (!deck) errors.push(`Member seat ${seat.seat} references an unknown deck.`);
        else {
          if (deck.playerId !== seat.playerId) errors.push(`Member seat ${seat.seat} must use a deck they own.`);
          if (deck.commanderId !== seat.commanderId) errors.push(`Member seat ${seat.seat} commander does not match the selected deck.`);
        }
      }
    }
  }

  if (input.winnerSeat === null || !seatNumbers.includes(input.winnerSeat)) errors.push("A manual game must have exactly one winning seat in the roster.");
  return errors;
}

/** Validate invariants shared by the offline import plan and historical-data fixtures. */
export function validateHistoricalGame(game: HistoricalGame, seats: HistoricalSeat[]): string[] {
  const errors: string[] = [];
  if (!game.gameId || !game.sourceGameKey) errors.push("Game IDs and source keys are required.");
  if (!isValidIsoDate(game.playedOn)) errors.push(`Invalid date for ${game.gameId}.`);
  if (game.dateOrigin !== "Explicit" && game.dateOrigin !== "Carried forward") errors.push(`Invalid date origin for ${game.gameId}.`);
  if (!Number.isInteger(game.podSize) || game.podSize < 3 || game.podSize > 6) errors.push(`Invalid pod size for ${game.gameId}.`);
  if (seats.length !== game.podSize) errors.push(`Seat count does not match pod size for ${game.gameId}.`);

  const orderedSeats = [...seats].sort((a, b) => a.seat - b.seat);
  if (orderedSeats.some((seat, index) => seat.seat !== index + 1)) errors.push(`Seats are not contiguous for ${game.gameId}.`);
  if (seats.some((seat) => seat.gameId !== game.gameId || seat.sourceGameKey !== game.sourceGameKey)) errors.push(`Seat source key does not match game ${game.gameId}.`);
  if (seats.some((seat) => !seat.commanderId)) errors.push(`A commander is missing for ${game.gameId}.`);
  if (seats.some((seat) => seat.playerId === null && (seat.deckId !== null || seat.displayPlayer !== "Guest"))) errors.push(`Guest seat is not sanitized for ${game.gameId}.`);
  if (seats.some((seat) => seat.playerId !== null && (!seat.deckId || seat.displayPlayer === "Guest"))) errors.push(`Member seat is missing its member deck/display for ${game.gameId}.`);

  const memberIds = seats.map((seat) => seat.playerId).filter((id): id is string => id !== null);
  if (new Set(memberIds).size !== memberIds.length) errors.push(`Member appears in more than one seat for ${game.gameId}.`);
  const memberCount = seats.filter((seat) => seat.playerId !== null).length;
  if (memberCount !== game.memberCount) errors.push(`Member count mismatch for ${game.gameId}.`);
  const winnerSeats = seats.filter((seat) => seat.isWinner).map((seat) => seat.seat);
  if (game.result === "single_winner") {
    if (game.winnerSeat === null || winnerSeats.length !== 1 || winnerSeats[0] !== game.winnerSeat) errors.push(`Single-winner seat mismatch for ${game.gameId}.`);
  } else if (game.winnerSeat !== null || winnerSeats.length !== 0) {
    errors.push(`Exceptional result must have no winning seat flags for ${game.gameId}.`);
  }

  const eligibility = getEligibility(game, seats);
  if (eligibility.memberCount !== game.memberCount) errors.push(`Eligibility member count mismatch for ${game.gameId}.`);
  if (eligibility.participationEligible !== game.analyticsEligible) errors.push(`Participation eligibility mismatch for ${game.gameId}.`);
  if (eligibility.winStatsEligible !== game.winStatsEligible) errors.push(`Win eligibility mismatch for ${game.gameId}.`);
  if (eligibility.officialFourPlayerWinStatsEligible !== game.officialFourPlayerWinStatsEligible) errors.push(`Official four-player eligibility mismatch for ${game.gameId}.`);
  return errors;
}
