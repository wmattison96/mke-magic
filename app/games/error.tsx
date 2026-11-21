"use client";

import { AppShell } from "@/components/app-shell";

export default function GamesError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <AppShell activePath="/games"><div className="mx-auto max-w-xl rounded-2xl border border-rose-200 bg-white p-7 shadow-sm">
    <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-rose-600">Game history unavailable</p>
    <h1 className="mt-2 text-xl font-semibold text-slate-900">We couldn’t load the database records.</h1>
    <p className="mt-2 text-sm leading-6 text-slate-500">The Games page does not fall back to sample data. Check the Supabase connection and try again.</p>
    <button onClick={() => reset()} className="mt-5 rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-medium text-white">Retry</button>
  </div></AppShell>;
}
