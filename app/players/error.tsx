"use client";

export default function PlayersError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <section className="mx-auto max-w-2xl rounded-2xl border border-rose-200 bg-white p-6 shadow-sm"><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-rose-600">PLAYER DATA UNAVAILABLE</p><h1 className="mt-2 text-lg font-semibold text-slate-900">We could not load player profiles.</h1><p className="mt-2 text-sm leading-6 text-slate-500">The database request failed. No sample statistics are being shown.</p><button type="button" onClick={() => reset()} className="mt-5 rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-medium text-white">Try again</button></section>;
}
