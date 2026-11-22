"use server";

import { revalidatePath, updateTag } from "next/cache";
import { PUBLIC_DECKS_TAG, PUBLIC_PLAYERS_TAG } from "@/lib/data/cache-tags";
import { normalizeMoxfieldUrl } from "@/lib/profiles/moxfield-url";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMemberContext } from "@/lib/supabase/verified-user";

export interface MoxfieldActionState {
  error?: string;
  success?: string;
}

export async function saveMoxfieldUrl(_previous: MoxfieldActionState, formData: FormData): Promise<MoxfieldActionState> {
  const type = formData.get("type");
  const recordId = formData.get("recordId");
  if ((type !== "player" && type !== "deck") || typeof recordId !== "string" || !recordId) return { error: "This Moxfield link could not be saved." };
  const rawValue = formData.get("moxfieldUrl");
  const value = normalizeMoxfieldUrl(typeof rawValue === "string" ? rawValue : undefined, type);
  if (value === undefined) return { error: `Use an HTTPS Moxfield ${type === "player" ? "user profile" : "deck"} URL, or leave the field blank.` };

  const member = await getCurrentMemberContext();
  if (!member || member.approvalStatus !== "approved") return { error: "Sign in with an approved playgroup account to edit this link." };
  const supabase = await createClient();
  const table = type === "player" ? "players" : "member_decks";
  const { data, error } = await supabase.from(table).update({ moxfield_url: value }).eq("id", recordId).select("id").maybeSingle();
  if (error || !data) return { error: "You can edit a Moxfield link only on your own profile or deck." };

  revalidatePath("/players");
  revalidatePath(`/players/${recordId}`);
  revalidatePath("/decks");
  revalidatePath(`/decks/${recordId}`);
  updateTag(type === "player" ? PUBLIC_PLAYERS_TAG : PUBLIC_DECKS_TAG);
  return { success: value ? "Moxfield link saved." : "Moxfield link removed." };
}
