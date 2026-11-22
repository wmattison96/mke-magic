"use server";

import { revalidatePath, updateTag } from "next/cache";
import { PUBLIC_GAME_LOG_TAG } from "@/lib/data/cache-tags";
import { createClient } from "@/lib/supabase/server";
import { getVerifiedUserClaims } from "@/lib/supabase/verified-user";

export interface CorrectionInput {
  gameId: string;
  playedOn: string;
  location: string;
  notes: string;
  resultType: "single_winner" | "draw" | "shared_winner" | "winner_missing";
  winningSeat: number | null;
  reason: string;
}

export type CorrectionResult = { ok: true } | { ok: false; message: string };

export async function correctCompletedGame(input: CorrectionInput): Promise<CorrectionResult> {
  const claims = await getVerifiedUserClaims();
  if (!claims?.sub) return { ok: false, message: "Sign in with the approved administrator account to correct history." };
  if (!input || typeof input.gameId !== "string" || !/^[0-9a-f-]{36}$/i.test(input.gameId)
      || typeof input.playedOn !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input.playedOn)
      || typeof input.location !== "string" || typeof input.notes !== "string" || typeof input.reason !== "string"
      || (input.winningSeat !== null && !Number.isInteger(input.winningSeat))) {
    return { ok: false, message: "Check the game and date, then try again." };
  }
  if (input.location.length > 120 || input.notes.length > 5000 || input.reason.trim().length < 8) {
    return { ok: false, message: "Location, notes, and correction reason do not meet the required lengths." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("correct_completed_game", {
    p_game_id: input.gameId,
    p_played_on: input.playedOn,
    p_location: input.location.trim() || null,
    p_public_notes: input.notes.trim() || null,
    p_result_type: input.resultType,
    p_winning_seat: input.winningSeat,
    p_change_reason: input.reason.trim(),
  });
  if (error) {
    if (error.code === "42501") return { ok: false, message: "Only an approved administrator can correct completed games." };
    if (error.code === "22023") return { ok: false, message: error.message };
    if (error.code === "23505") return { ok: false, message: "That correction conflicts with another game's date number." };
    if (error.code === "23514") return { ok: false, message: "That correction does not match the rules for this game record." };
    return { ok: false, message: "The correction could not be saved. The original record is unchanged." };
  }
  revalidatePath("/games");
  revalidatePath("/");
  updateTag(PUBLIC_GAME_LOG_TAG);
  return { ok: true };
}

export async function deleteCompletedGame(gameId: string, reason: string): Promise<CorrectionResult> {
  const claims = await getVerifiedUserClaims();
  if (!claims?.sub) return { ok: false, message: "Sign in with the approved administrator account to delete history." };
  if (typeof gameId !== "string" || !/^[0-9a-f-]{36}$/i.test(gameId) || typeof reason !== "string" || reason.trim().length < 8 || reason.length > 500) {
    return { ok: false, message: "Enter a reason of at least 8 characters before deleting." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_completed_game", {
    p_game_id: gameId,
    p_change_reason: reason.trim(),
  });
  if (error) {
    if (error.code === "42501") return { ok: false, message: "Only an approved administrator can delete completed games." };
    if (error.code === "22023") return { ok: false, message: error.message };
    return { ok: false, message: "The game could not be deleted. The original record is unchanged." };
  }
  revalidatePath("/games");
  revalidatePath("/");
  updateTag(PUBLIC_GAME_LOG_TAG);
  return { ok: true };
}
