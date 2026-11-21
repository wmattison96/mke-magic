import { AppShell } from "@/components/app-shell";

export default function GamesLoading() {
  return <AppShell activePath="/games"><div role="status" aria-live="polite" className="space-y-6">
    <span className="sr-only">Loading the game history…</span>
    <div className="h-24 animate-pulse rounded-2xl bg-slate-200/70"/>
    <div className="grid gap-4 sm:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-28 animate-pulse rounded-2xl bg-white"/>)}</div>
    <div className="h-72 animate-pulse rounded-2xl bg-white"/>
    <div className="h-[28rem] animate-pulse rounded-2xl bg-white"/>
  </div></AppShell>;
}
