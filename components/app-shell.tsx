import type { ReactNode } from "react";
import Link from "next/link";

const navigation: { label: string; href: string; icon: string; deferred?: boolean }[] = [
  { label: "Dashboard", href: "/", icon: "grid" },
  { label: "Players", href: "/players", icon: "users" },
  { label: "Decks", href: "/decks", icon: "cards" },
  { label: "Games", href: "/games", icon: "swords" },
  { label: "Tracking", href: "/tracking", icon: "plus" },
  { label: "Analytics", href: "/analytics", icon: "chart" },
  { label: "Play", href: "/play", icon: "play" },
];

function NavIcon({ name }: { name: string }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths: Record<string, ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    cards: <><rect x="5" y="4" width="13" height="17" rx="2"/><path d="M9 4V3a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-1"/><path d="M9 9h5M9 13h5"/></>,
    swords: <><path d="m14.5 17.5 3 3 3-3-3-3"/><path d="M17.5 14.5 21 11l-8-8-3.5 3.5"/><path d="m9.5 6.5 8 8"/><path d="m3 21 7-7M7 21H3v-4"/><path d="m6.5 9.5-3-3 3-3 3 3"/><path d="m9.5 6.5 8 8"/></>,
    plus: <><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></>,
    chart: <><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-5 5"/></>,
    play: <><circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4z"/></>,
  };
  return <svg {...common} aria-hidden="true">{paths[name]}</svg>;
}

function Brand() {
  return <Link className="flex items-center gap-3 px-1" href="/" aria-label="MKE Magic dashboard">
    <span className="grid size-10 place-items-center rounded-xl bg-indigo-500 text-white shadow-lg shadow-indigo-950/40">
      <svg viewBox="0 0 32 32" className="size-6" aria-hidden="true"><path d="M5 24V8h4l7 9 7-9h4v16h-5v-8l-6 7-6-7v8z" fill="currentColor"/></svg>
    </span>
    <span><span className="block text-[15px] font-semibold tracking-wide text-slate-900 lg:text-white">MKE Magic</span><span className="block text-[10px] font-medium uppercase tracking-[.18em] text-slate-500">playgroup analytics</span></span>
  </Link>;
}

function Navigation({ activePath, mobile = false }: { activePath: string; mobile?: boolean }) {
  return <nav aria-label="Main navigation" className={mobile ? "flex min-w-max gap-1 px-4 py-2" : "space-y-1"}>
    {!mobile && <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[.18em] text-slate-500">Workspace</p>}
    {navigation.map((item) => {
      const active = activePath === item.href || (item.href !== "/" && activePath.startsWith(item.href));
      return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`${mobile ? "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs" : "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px]"} ${active ? "bg-indigo-500/15 font-medium text-indigo-200 ring-1 ring-inset ring-indigo-400/15" : "text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-100"}`}>
        <NavIcon name={item.icon}/>{item.label}{item.deferred && <span className="ml-auto rounded bg-white/5 px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-wide text-slate-500">Coming later</span>}
      </Link>;
    })}
  </nav>;
}

export function AppShell({ children, activePath }: { children: ReactNode; activePath: string }) {
  const usesLiveRecords = activePath === "/" || activePath === "/games" || activePath === "/tracking" || activePath === "/players" || activePath === "/decks" || activePath === "/analytics" || activePath === "/play";
  const recordScope = activePath === "/" ? "Eligible 4-player statistics" : activePath === "/play" ? "Four-player life tracker" : "All recorded pods";
  return <div className="min-h-screen bg-[#f4f6fa] text-slate-900 lg:flex">
    <aside className="hidden w-[250px] shrink-0 flex-col border-r border-slate-800 bg-[#111827] px-5 py-6 lg:sticky lg:top-0 lg:flex lg:h-screen">
      <Brand />
      <div className="mt-10"><Navigation activePath={activePath}/></div>
      <div className="mt-auto rounded-2xl border border-white/8 bg-white/[.035] p-4">
        <div className="flex items-center gap-2"><span className={`size-2 rounded-full ${usesLiveRecords ? "bg-emerald-400" : "bg-slate-500"}`}/><span className="text-[10px] font-semibold uppercase tracking-[.16em] text-slate-400">{usesLiveRecords ? "Live records" : "Demo workspace"}</span></div>
        <p className="mt-3 text-sm font-medium text-slate-200">{usesLiveRecords ? "Shared playgroup" : "The Wednesday Pod"}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">{activePath === "/" ? "Dashboard uses live Supabase records." : usesLiveRecords ? "This page uses current Supabase records." : "Sample data · not connected to a database"}</p>
      </div>
    </aside>
    <div className="min-w-0 flex-1">
      <div className="border-b border-slate-200 bg-white lg:hidden"><div className="flex items-center justify-between px-4 py-3"><Brand/><div className="flex items-center gap-2"><span className="rounded-md bg-indigo-50 px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-indigo-700">{usesLiveRecords ? "Live" : "Demo"}</span><span className="grid size-9 place-items-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-700">MT</span></div></div><div className="overflow-x-auto border-t border-slate-100"><Navigation activePath={activePath} mobile/></div></div>
      <header className="hidden h-[68px] items-center justify-between border-b border-slate-200 bg-white px-8 lg:flex xl:px-10">
        <div className="flex items-center gap-2 text-xs text-slate-400"><span>Workspace</span><span>/</span><span className="font-medium text-slate-700">{usesLiveRecords ? "Shared playgroup" : "The Wednesday Pod"}</span><span className="ml-1 rounded-md bg-slate-100 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-slate-500">{usesLiveRecords ? "Live records" : "Demo"}</span></div>
        <div className="flex items-center gap-4"><span className="text-xs text-slate-500">{usesLiveRecords ? recordScope : "Commander · 4-player pods"}</span><span className="grid size-9 place-items-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-700">MT</span></div>
      </header>
      <main className={activePath === "/play" ? "mx-auto min-h-[calc(100svh-128px)] w-full max-w-none p-0 lg:min-h-[calc(100vh-68px)]" : "mx-auto w-full max-w-[1500px] px-4 py-7 sm:px-7 sm:py-9 xl:px-10"}>{children}</main>
    </div>
  </div>;
}
