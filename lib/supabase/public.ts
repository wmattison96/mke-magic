import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Stateless client for public, RLS-protected readable_* projections only.
 * Never use this client for private membership checks or writes.
 */
export function createPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error("Supabase is not configured. Set the public URL and publishable key in .env.local.");
  }

  return createSupabaseClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}
