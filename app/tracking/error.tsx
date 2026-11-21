"use client";

import { AppShell } from "@/components/app-shell";

export default function TrackingError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <AppShell activePath="/tracking"><div className="mx-auto max-w-xl rounded-2xl border border-rose-200 bg-white p-7 shadow-sm">
    <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-rose-600">Tracking unavailable</p>
    <h1 className="mt-2 text-xl font-semibold text-slate-900">We couldn’t load the member and deck choices.</h1>
    <p className="mt-2 text-sm leading-6 text-slate-500">No sample records are substituted. Check the Supabase connection and try again.</p>
    <button onClick={() => reset()} className="mt-5 rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-medium text-white">Retry</button>
  </div></AppShell>;
}
