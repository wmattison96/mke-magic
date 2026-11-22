"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/browser";
import { Panel } from "@/components/ui";

type ConfirmType = "invite" | "recovery";
type ConfirmState = "loading" | ConfirmType | "invalid" | "error";

export function AuthConfirmation() {
  const router = useRouter();
  const credentials = useRef<{ tokenHash: string; type: ConfirmType } | null>(null);
  const [state, setState] = useState<ConfirmState>("loading");
  const [canRetry, setCanRetry] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, startBusy] = useTransition();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const url = new URL(window.location.href);
      const tokenHash = url.searchParams.get("token_hash");
      const rawType = url.searchParams.get("type");
      window.history.replaceState(null, "", window.location.pathname);

      if (!tokenHash || (rawType !== "invite" && rawType !== "recovery")) {
        setState("invalid");
        return;
      }

      credentials.current = { tokenHash, type: rawType };
      setCanRetry(true);
      setState(rawType);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function confirm() {
    const value = credentials.current;
    if (!value) return;
    setMessage("");
    startBusy(async () => {
      try {
        const { error } = await createClient().auth.verifyOtp({
          token_hash: value.tokenHash,
          type: value.type as EmailOtpType,
        });
        credentials.current = null;
        setCanRetry(false);
        if (error) {
          setState("error");
          setMessage("This link is invalid or has expired. Request a new password reset link, or ask the administrator to resend your invitation.");
          return;
        }
        router.replace("/auth/update-password");
      } catch {
        setCanRetry(true);
        setState("error");
        setMessage("We could not confirm this link. Check your connection and try again, or request a fresh link.");
      }
    });
  }

  const isInvite = state === "invite";
  const title = state === "loading" ? "Checking your link…"
    : state === "invalid" || state === "error" ? "Confirmation unavailable"
      : isInvite ? "Accept your invitation" : "Continue password reset";
  return <Panel title={title} subtitle={state === "loading" || state === "invalid" || state === "error" ? undefined : "This one-time link is confirmed only after you continue."}>
    <div className="space-y-4 p-5 sm:p-6">
      {state === "loading" && <p role="status" className="text-sm text-slate-500">Preparing secure account confirmation…</p>}
      {(state === "invite" || state === "recovery") && <>
        <p className="text-sm leading-6 text-slate-600">{isInvite ? "Confirm your email to finish setting up your MKE Magic account." : "Confirm your email to choose a new password."}</p>
        <button type="button" disabled={busy} onClick={confirm} className="rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50">{busy ? "Confirming…" : isInvite ? "Accept invitation" : "Continue"}</button>
      </>}
      {state === "invalid" && <div className="space-y-4"><p role="alert" className="text-sm leading-6 text-rose-700">This confirmation link is incomplete or no longer available.</p><Link href="/auth/forgot-password" className="inline-flex rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-medium text-slate-600">Request a password reset</Link></div>}
      {state === "error" && <div className="space-y-4"><p role="alert" className="text-sm leading-6 text-rose-700">{message}</p><div className="flex flex-wrap gap-2">{canRetry && <button type="button" disabled={busy} onClick={confirm} className="rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50">Try again</button>}<Link href="/tracking" className="inline-flex rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-medium text-slate-600">Return to sign in</Link></div></div>}
    </div>
  </Panel>;
}
