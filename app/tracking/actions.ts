"use server";

import { revalidatePath, updateTag } from "next/cache";
import { PUBLIC_COMMANDERS_TAG, PUBLIC_DECKS_TAG, PUBLIC_GAME_LOG_TAG } from "@/lib/data/cache-tags";
import { createClient } from "@/lib/supabase/server";
import { getVerifiedUserClaims } from "@/lib/supabase/verified-user";

export interface SubmittedSeat {
  seat: number;
  participantType: "member" | "guest";
  playerId: string | null;
  deckId: string | null;
  commanderId: string | null;
  commanderName: string | null;
}

export interface GameSubmission {
  submissionId: string;
  playedOn: string;
  location: string;
  notes: string;
  seats: SubmittedSeat[];
  winningSeat: number;
}

export type CreateGameResult =
  | { ok: true; gameId: string; gameNumberOnDate: number }
  | { ok: false; message: string };

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

export async function createManualGame(input: GameSubmission): Promise<CreateGameResult> {
  if (!input || typeof input !== "object" || !Array.isArray(input.seats)
      || typeof input.submissionId !== "string" || !/^[0-9a-f-]{36}$/i.test(input.submissionId)
      || typeof input.playedOn !== "string" || typeof input.location !== "string" || typeof input.notes !== "string"
      || !Number.isInteger(input.winningSeat)
      || input.seats.some((seat) => !seat || typeof seat !== "object"
        || !Number.isInteger(seat.seat)
        || (seat.participantType !== "member" && seat.participantType !== "guest")
        || (seat.playerId !== null && typeof seat.playerId !== "string")
        || (seat.deckId !== null && typeof seat.deckId !== "string")
        || (seat.commanderId !== null && typeof seat.commanderId !== "string")
        || (seat.commanderName !== null && typeof seat.commanderName !== "string"))) {
    return { ok: false, message: "The game details are incomplete. Please review the seats and try again." };
  }
  if (!isIsoDate(input.playedOn) || input.location.length > 120 || input.notes.length > 5000) {
    return { ok: false, message: "Check the date, location, and note lengths." };
  }
  if (input.seats.length < 3 || input.seats.length > 6) {
    return { ok: false, message: "A game must have 3 to 6 seats." };
  }
  if (input.seats.some((seat, index) => seat.seat !== index + 1)) {
    return { ok: false, message: "Seats must be contiguous and ordered from 1 through the pod size." };
  }
  const memberIds = input.seats.filter((seat) => seat.participantType === "member").map((seat) => seat.playerId);
  if (memberIds.some((id) => !id) || new Set(memberIds).size !== memberIds.length) {
    return { ok: false, message: "Choose each member once; members cannot appear twice in one game." };
  }
  for (const seat of input.seats) {
    if (!seat.commanderId && !seat.commanderName?.trim()) {
      return { ok: false, message: `Choose a commander for seat ${seat.seat}.` };
    }
    if (seat.participantType === "guest" && (seat.playerId !== null || seat.deckId !== null)) {
      return { ok: false, message: "Guest seats cannot use member or saved deck identities." };
    }
    if (seat.participantType === "member" && !seat.playerId) {
      return { ok: false, message: `Choose the member for seat ${seat.seat}.` };
    }
  }
  if (!input.seats.some((seat) => seat.seat === input.winningSeat)) {
    return { ok: false, message: "Choose exactly one winning seat from the roster." };
  }

  const claims = await getVerifiedUserClaims();
  if (!claims?.sub) return { ok: false, message: "Sign in with an approved playgroup account to record a game." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_manual_game", {
    p_client_submission_id: input.submissionId,
    p_played_on: input.playedOn,
    p_location: input.location.trim() || null,
    p_public_notes: input.notes.trim() || null,
    p_seats: input.seats,
    p_winning_seat: input.winningSeat,
  });
  if (error) {
    if (error.code === "42501") return { ok: false, message: "This account is not approved to record games." };
    if (error.code === "23505") return { ok: false, message: "That game conflicts with an existing record. Refresh and review the history." };
    if (error.code === "22023") return { ok: false, message: error.message };
    return { ok: false, message: "The game could not be saved. Your form is still here; please retry or contact the playgroup administrator." };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.game_id || !row?.game_number_on_date) {
    return { ok: false, message: "The game was submitted, but its confirmation could not be read. Check Games before retrying." };
  }
  revalidatePath("/games");
  revalidatePath("/");
  updateTag(PUBLIC_GAME_LOG_TAG);
  updateTag(PUBLIC_COMMANDERS_TAG);
  updateTag(PUBLIC_DECKS_TAG);
  return { ok: true, gameId: row.game_id, gameNumberOnDate: Number(row.game_number_on_date) };
}
