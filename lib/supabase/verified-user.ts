import "server-only";
import { createClient } from "./server";

/** Returns only claims verified by Supabase; never authorize from getSession(). */
export async function getVerifiedUserClaims() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error) {
    if ((error as { name?: string }).name === "AuthSessionMissingError") return null;
    throw new Error("Unable to verify the Supabase session.");
  }
  return data?.claims ?? null;
}

export interface MemberContext {
  playerId: string;
  playerName: string;
  role: "member" | "admin";
  approvalStatus: "approved" | "pending" | "revoked";
}

export async function getCurrentMemberContext(): Promise<MemberContext | null> {
  const claims = await getVerifiedUserClaims();
  if (!claims?.sub) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("current_member_context");
  if (error) throw new Error("Unable to load this account's playgroup permissions.");
  return (data as MemberContext | null) ?? null;
}
