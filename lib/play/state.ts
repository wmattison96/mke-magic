export interface PlaySetupSeat {
  seat: number;
  participantType: "member" | "guest";
  playerId: string | null;
  deckId: string | null;
  commanderId: string | null;
  commanderName: string | null;
  playerName?: string | null;
  deckName?: string | null;
}

export interface PlayCommanderIdentity {
  id: string;
  name: string;
}

export interface PlaySeat extends PlaySetupSeat {
  id: string;
  commanders: PlayCommanderIdentity[];
}

export interface PlaySession {
  version: 1;
  sessionId: string;
  submissionId: string;
  startedByPlayerId: string;
  startedByPlayerName: string;
  playedOn: string;
  startedAt: string;
  seats: PlaySeat[];
  lifeTotals: Record<string, number>;
  /** Keyed by receiving seat ID and a particular opposing commander ID. */
  commanderDamage: Record<string, number>;
  notes: string;
  winningSeat: number | null;
  /** Once an RPC attempt begins, keep its fingerprint inputs fixed for safe retries. */
  submissionLocked: boolean;
}

export interface PlayGameSubmission {
  submissionId: string;
  playedOn: string;
  location: string;
  notes: string;
  seats: Array<{
    seat: number;
    participantType: "member" | "guest";
    playerId: string | null;
    deckId: string | null;
    commanderId: string | null;
    commanderName: string | null;
  }>;
  winningSeat: number;
}

const UUID_PATTERN = /^[0-9a-f-]{36}$/i;

/** Assigns new Play sessions the site's Chicago calendar date. */
export function getPlayDate(now = new Date(), timeZone = "America/Chicago"): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function validatePlaySetup(seats: PlaySetupSeat[]): string[] {
  const problems: string[] = [];
  if (seats.length !== 4) problems.push("Play supports exactly four seats.");
  if (seats.some((seat, index) => seat.seat !== index + 1)) problems.push("Seats must be ordered from 1 through 4.");
  const memberIds = seats.filter((seat) => seat.participantType === "member").map((seat) => seat.playerId).filter((id): id is string => Boolean(id));
  if (new Set(memberIds).size !== memberIds.length) problems.push("Each member can only be seated once.");
  for (const seat of seats) {
    if (seat.participantType === "member" && !seat.playerId) problems.push(`Choose a member for Seat ${seat.seat}.`);
    if (!seat.commanderId && !seat.commanderName?.trim()) problems.push(`Choose a commander for Seat ${seat.seat}.`);
    if (seat.participantType === "guest" && (seat.playerId !== null || seat.deckId !== null)) problems.push(`Guest Seat ${seat.seat} cannot use a member or deck identity.`);
  }
  return problems;
}

export function createPlaySession({
  seats,
  startedByPlayerId,
  startedByPlayerName,
  playedOn,
  submissionId,
  sessionId = submissionId,
  startedAt = new Date().toISOString(),
}: {
  seats: PlaySetupSeat[];
  startedByPlayerId: string;
  startedByPlayerName: string;
  playedOn: string;
  submissionId: string;
  sessionId?: string;
  startedAt?: string;
}): PlaySession {
  const normalizedSeats = [...seats].sort((a, b) => a.seat - b.seat).map((seat) => {
    const id = `seat-${seat.seat}`;
    const names = (seat.commanderName ?? "").split(/\s+\/\s+(?!\/)/).map((name) => name.trim()).filter(Boolean);
    return {
      ...seat,
      id,
      commanders: names.map((name, index) => ({ id: `${id}-commander-${index + 1}`, name })),
    };
  });

  return {
    version: 1,
    sessionId,
    submissionId,
    startedByPlayerId,
    startedByPlayerName,
    playedOn,
    startedAt,
    seats: normalizedSeats,
    lifeTotals: Object.fromEntries(normalizedSeats.map((seat) => [seat.id, 40])),
    commanderDamage: {},
    notes: "",
    winningSeat: null,
    submissionLocked: false,
  };
}

export function commanderDamageKey(targetSeatId: string, sourceCommanderId: string): string {
  return `${targetSeatId}::${sourceCommanderId}`;
}

export function adjustLife(session: PlaySession, seatId: string, delta: -1 | 1): PlaySession {
  if (!session.seats.some((seat) => seat.id === seatId)) return session;
  return {
    ...session,
    lifeTotals: { ...session.lifeTotals, [seatId]: session.lifeTotals[seatId] + delta },
  };
}

/** A damage point changes that seat's life by the inverse amount; no counter can fall below zero. */
export function adjustCommanderDamage(
  session: PlaySession,
  targetSeatId: string,
  sourceCommanderId: string,
  delta: -1 | 1,
): PlaySession {
  const target = session.seats.find((seat) => seat.id === targetSeatId);
  const source = session.seats.find((seat) => seat.commanders.some((commander) => commander.id === sourceCommanderId));
  if (!target || !source || target.id === source.id) return session;

  const key = commanderDamageKey(targetSeatId, sourceCommanderId);
  const currentDamage = session.commanderDamage[key] ?? 0;
  const nextDamage = Math.max(0, currentDamage + delta);
  const appliedDelta = nextDamage - currentDamage;
  if (appliedDelta === 0) return session;

  return {
    ...session,
    commanderDamage: { ...session.commanderDamage, [key]: nextDamage },
    lifeTotals: { ...session.lifeTotals, [targetSeatId]: session.lifeTotals[targetSeatId] - appliedDelta },
  };
}

export function toPlayGameSubmission(session: PlaySession): PlayGameSubmission | null {
  if (!session.winningSeat || !session.seats.some((seat) => seat.seat === session.winningSeat)) return null;
  return {
    submissionId: session.submissionId,
    playedOn: session.playedOn,
    location: "",
    notes: session.notes,
    winningSeat: session.winningSeat,
    seats: session.seats.map(({ seat, participantType, playerId, deckId, commanderId, commanderName }) => ({
      seat,
      participantType,
      playerId,
      deckId,
      commanderId,
      commanderName,
    })),
  };
}

export function isPlaySession(value: unknown): value is PlaySession {
  if (!value || typeof value !== "object") return false;
  const session = value as Partial<PlaySession>;
  if (session.version !== 1 || !UUID_PATTERN.test(session.sessionId ?? "") || !UUID_PATTERN.test(session.submissionId ?? "")
      || typeof session.startedByPlayerId !== "string" || !session.startedByPlayerId
      || typeof session.startedByPlayerName !== "string" || !session.startedByPlayerName
      || typeof session.playedOn !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(session.playedOn)
      || typeof session.startedAt !== "string" || !Number.isFinite(Date.parse(session.startedAt))
      || typeof session.notes !== "string" || session.notes.length > 5000
      || typeof session.submissionLocked !== "boolean"
      || !Array.isArray(session.seats) || session.seats.length !== 4
      || !session.lifeTotals || typeof session.lifeTotals !== "object"
      || !session.commanderDamage || typeof session.commanderDamage !== "object") return false;

  const memberIds: string[] = [];
  for (const [index, seat] of session.seats.entries()) {
    if (!seat || seat.seat !== index + 1 || seat.id !== `seat-${index + 1}`
        || (seat.participantType !== "member" && seat.participantType !== "guest")
        || typeof seat.commanderName !== "string" || !seat.commanderName.trim()
        || !Array.isArray(seat.commanders) || seat.commanders.length < 1 || seat.commanders.length > 2
        || seat.commanders.some((commander, commanderIndex) => !commander
          || commander.id !== `${seat.id}-commander-${commanderIndex + 1}`
          || typeof commander.name !== "string" || !commander.name.trim())) return false;
    if (seat.participantType === "member") {
      if (!seat.playerId || typeof seat.playerId !== "string" || !seat.playerName || typeof seat.playerName !== "string") return false;
      memberIds.push(seat.playerId);
    } else if (seat.playerId !== null || seat.deckId !== null) return false;
  }
  if (new Set(memberIds).size !== memberIds.length) return false;

  const seatIds = session.seats.map((seat) => seat.id);
  if (Object.keys(session.lifeTotals).length !== 4 || seatIds.some((id) => !Number.isInteger(session.lifeTotals?.[id]))) return false;
  const commanderIds = session.seats.flatMap((seat) => seat.commanders.map((commander) => commander.id));
  for (const [key, amount] of Object.entries(session.commanderDamage)) {
    const separator = key.indexOf("::");
    const targetId = key.slice(0, separator);
    const sourceId = key.slice(separator + 2);
    if (separator < 0 || !seatIds.includes(targetId) || !commanderIds.includes(sourceId)
        || !Number.isInteger(amount) || amount < 0
        || session.seats.find((seat) => seat.id === targetId)?.commanders.some((commander) => commander.id === sourceId)) return false;
  }
  if (session.winningSeat !== null && !session.seats.some((seat) => seat.seat === session.winningSeat)) return false;
  if (session.submissionLocked && session.winningSeat === null) return false;
  return true;
}

export function parsePlaySession(serialized: string | null): PlaySession | null {
  if (!serialized) return null;
  try {
    const value: unknown = JSON.parse(serialized);
    return isPlaySession(value) ? value : null;
  } catch {
    return null;
  }
}
