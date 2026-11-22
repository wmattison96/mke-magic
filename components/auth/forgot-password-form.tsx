"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/browser";
import { Panel } from "@/components/ui";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, startBusy] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    startBusy(async () => {
      try {
        const redirectTo = new URL("/auth/confirm", window.location.origin).toString();
        const { error } = await createClient().auth.resetPasswordForEmail(email.trim(), { redirectTo });
        if (error) {
          setMessage("The reset request could not be sent. Wait a moment and try again.");
          return;
        }
        setSent(true);
      } catch {
        setMessage("Supabase is unavailable or not configured. Check the connection and try again.");
      }
    });
  }

  return <Panel title="Request a reset link" subtitle="For privacy, the confirmation message is the same whether or not an account matches that email.">
    <form onSubmit={submit} className="grid gap-4 p-5 sm:max-w-xl sm:p-6">
      {sent ? <p role="status" className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900">If an account exists for that email, a password reset message will arrive shortly.</p> : <>
        <label className="text-xs font-medium text-slate-600">Email<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"/></label>
        <button disabled={busy} className="w-fit rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-medium text-white disabled:opacity-50">{busy ? "Sending…" : "Send reset email"}</button>
      </>}
      {message && <p role="alert" className="text-xs text-rose-700">{message}</p>}
      <Link href="/tracking" className="w-fit text-xs font-medium text-slate-500 hover:text-slate-700">Back to sign in</Link>
    </form>
  </Panel>;
}
