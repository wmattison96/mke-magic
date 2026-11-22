"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { Panel } from "@/components/ui";

export function PasswordUpdateForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, startBusy] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (password !== confirmPassword) {
      setMessage("The passwords do not match.");
      return;
    }

    startBusy(async () => {
      try {
        const client = createClient();
        const { data, error: userError } = await client.auth.getUser();
        if (userError || !data.user) {
          setMessage("This password link is no longer active. Request a new password reset link or ask the administrator for a new invitation.");
          return;
        }
        const { error } = await client.auth.updateUser({ password });
        if (error) {
          setMessage("The password could not be updated. Check the password requirements and try again.");
          return;
        }
        setPassword("");
        setConfirmPassword("");
        router.replace("/tracking");
      } catch {
        setMessage("Supabase could not update the password. Check your connection and retry.");
      }
    });
  }

  return <Panel title="Choose a new password" subtitle="Use at least 8 characters. Your account must still be approved before you can record games.">
    <form onSubmit={submit} className="grid gap-4 p-5 sm:max-w-xl sm:p-6">
      <label className="text-xs font-medium text-slate-600">New password<input required type="password" minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"/></label>
      <label className="text-xs font-medium text-slate-600">Confirm new password<input required type="password" minLength={8} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"/></label>
      <button disabled={busy} className="w-fit rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-medium text-white disabled:opacity-50">{busy ? "Saving password…" : "Save password"}</button>
      {message && <p role="alert" className="text-xs leading-5 text-rose-700">{message}</p>}
      <Link href="/tracking" className="w-fit text-xs font-medium text-slate-500 hover:text-slate-700">Back to sign in</Link>
    </form>
  </Panel>;
}
