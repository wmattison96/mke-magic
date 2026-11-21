import { AppShell } from "@/components/app-shell";

export default function TrackingLoading() {
  return <AppShell activePath="/tracking"><div role="status" aria-live="polite" className="space-y-6">
    <span className="sr-only">Loading tracking choices…</span>
    <div className="h-24 animate-pulse rounded-2xl bg-slate-200/70"/>
    <div className="grid gap-5 xl:grid-cols-[1fr_.68fr]"><div className="h-[38rem] animate-pulse rounded-2xl bg-white"/><div className="h-80 animate-pulse rounded-2xl bg-white"/></div>
  </div></AppShell>;
}
