"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PageHeading, Panel } from "@/components/ui";
import { formatRate, PodFilter, ScopeNote } from "@/components/profiles/primitives";
import type { DeckPerformance, PodFilter as PodSize } from "@/lib/stats/profiles";

type SortBy = "winRate" | "elo";

export function DeckDirectory({ decks, podFilter, recordedGames, participationGames, winGames }: {
  decks: DeckPerformance[];
  podFilter: PodSize;
  recordedGames: number;
  participationGames: number;
  winGames: number;
}) {
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("winRate");
  const eligible = useMemo(() => decks.filter((deck) => deck.winEligibleGames >= 5 && (sortBy === "winRate" ? deck.winRate !== null : deck.elo !== null)), [decks, sortBy]);
  const ranked = useMemo(() => [...eligible].sort((a, b) => {
    const primaryA = sortBy === "winRate" ? a.winRate ?? -1 : a.elo ?? -1;
    const primaryB = sortBy === "winRate" ? b.winRate ?? -1 : b.elo ?? -1;
    return primaryB - primaryA || b.winEligibleGames - a.winEligibleGames || a.name.localeCompare(b.name);
  }), [eligible, sortBy]);
  const best = ranked.slice(0, 10);
  const worst = [...ranked].reverse().slice(0, 5);
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return decks.filter((deck) => !needle || `${deck.name} ${deck.commanderName} ${deck.ownerName}`.toLocaleLowerCase().includes(needle));
  }, [decks, query]);

  return <div className="space-y-7">
    <PageHeading eyebrow="COMMANDER ARSENAL" title="Decks" description="Browse every member-owned commander combination, then compare established results in the selected pod size." action={<span className="rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-medium text-white shadow-sm">{decks.length} decks</span>}/>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><PodFilter value={podFilter} basePath="/decks"/><ScopeNote value={podFilter} recordedGames={recordedGames} participationGames={participationGames} winGames={winGames}/></div>
    <section className="grid gap-4 sm:grid-cols-3">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5"><p className="text-[10px] font-medium uppercase tracking-[.14em] text-slate-400">Registered member decks</p><p className="mt-2 text-2xl font-semibold text-slate-900">{decks.length}</p><p className="mt-1 text-[10px] text-slate-400">Owner + commander identity</p></div>
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5"><p className="text-[10px] font-medium uppercase tracking-[.14em] text-slate-400">Eligible games</p><p className="mt-2 text-2xl font-semibold text-slate-900">{winGames}</p><p className="mt-1 text-[10px] text-slate-400">Single winner · two or more members</p></div>
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5"><p className="text-[10px] font-medium uppercase tracking-[.14em] text-slate-400">Ranked decks</p><p className="mt-2 text-2xl font-semibold text-slate-900">{eligible.length}</p><p className="mt-1 text-[10px] text-slate-400">At least 5 eligible games</p></div>
    </section>
    <Panel title="Deck rankings" subtitle="Only decks with at least 5 eligible single-winner games appear in ranked lists" action={<label className="flex items-center gap-2 text-[10px] text-slate-500">Sort by<select value={sortBy} onChange={(event) => setSortBy(event.target.value as SortBy)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[10px] text-slate-700"><option value="winRate">Win rate</option><option value="elo">Provisional Elo</option></select></label>}>
      <div className="grid gap-0 divide-y divide-slate-100 xl:grid-cols-2 xl:divide-x xl:divide-y-0">
        <RankedDeckList title="Best 10" decks={best} sortBy={sortBy}/><RankedDeckList title="Lowest 5" decks={worst} sortBy={sortBy}/>
      </div>
    </Panel>
    <Panel title="All member-owned decks" subtitle="Search by commander or owner; unused and small-sample decks remain accessible">
      <div className="border-b border-slate-100 p-4 sm:px-6"><label htmlFor="deck-search" className="sr-only">Search decks by commander or owner</label><input id="deck-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search commander or player" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100"/></div>
      {filtered.length ? <ul className="grid min-w-0 gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">{filtered.map((deck) => <li key={deck.id} className="min-w-0"><DeckCard deck={deck} podFilter={podFilter}/></li>)}</ul> : <p className="px-5 py-8 text-sm text-slate-400 sm:px-6">No member-owned deck matches “{query}”.</p>}
    </Panel>
    <p className="text-center text-[10px] leading-5 text-slate-400">Each deck is keyed by its owner and canonical commander configuration. Guest commanders remain in game history and never become member-owned deck records.</p>
  </div>;
}

function RankedDeckList({ title, decks, sortBy }: { title: string; decks: DeckPerformance[]; sortBy: SortBy }) {
  return <section className="min-w-0 p-4 sm:p-5"><h3 className="mb-3 text-xs font-semibold text-slate-700">{title}</h3>{decks.length ? <ol className="space-y-1.5">{decks.map((deck, index) => <li key={deck.id}><Link href={`/decks/${deck.id}`} className="flex items-center gap-3 rounded-xl px-2.5 py-3 transition-colors hover:bg-slate-50"><span className="grid size-7 shrink-0 place-items-center rounded-lg bg-indigo-50 text-[10px] font-semibold text-indigo-700">{index + 1}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium text-slate-800">{deck.name}</span><span className="mt-1 block truncate text-[9px] text-slate-400">{deck.ownerName} · {deck.wins}/{deck.winEligibleGames} wins/games</span></span><span className="shrink-0 text-right text-xs font-semibold tabular-nums text-slate-700">{sortBy === "winRate" ? formatRate(deck.winRate) : deck.elo}<span className="block text-[8px] font-normal uppercase tracking-wide text-slate-400">{sortBy === "winRate" ? "win rate" : "Elo"}</span></span></Link></li>)}</ol> : <p className="rounded-xl bg-slate-50 px-3 py-4 text-[10px] leading-5 text-slate-400">No deck meets the five-game minimum in this selected sample.</p>}</section>;
}

function DeckCard({ deck, podFilter }: { deck: DeckPerformance; podFilter: PodSize }) {
  const rankable = deck.winEligibleGames >= 5;
  return <article className="min-w-0 h-full rounded-xl border border-slate-200/80 bg-white p-4 transition hover:border-indigo-200 hover:shadow-sm">
    <div className="flex items-start justify-between gap-3"><Link href={`/decks/${deck.id}?pods=${podFilter}`} className="min-w-0"><span className="block truncate text-xs font-semibold text-slate-800 hover:text-indigo-700">{deck.name}</span><span className="mt-1 block truncate text-[10px] text-slate-400">{deck.commanderName}</span></Link><span className="shrink-0 rounded-lg bg-slate-50 px-2 py-1 text-[9px] text-slate-500">{deck.winEligibleGames} games</span></div>
    <p className="mt-3 text-[10px] text-slate-500">Owned by <Link href={`/players/${deck.ownerId}?pods=${podFilter}`} className="font-medium text-indigo-600 hover:text-indigo-800">{deck.ownerName}</Link></p>
    <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3"><SmallMetric label="Wins" value={String(deck.wins)}/><SmallMetric label="Win rate" value={rankable ? formatRate(deck.winRate) : "N/A"}/><SmallMetric label="Elo" value={rankable && deck.elo !== null ? String(deck.elo) : "N/A"}/></div>
    {!rankable && <p className="mt-2 text-[9px] text-slate-400">Small sample · 5 eligible games required for rankings</p>}
  </article>;
}

function SmallMetric({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[8px] uppercase tracking-[.12em] text-slate-400">{label}</p><p className="mt-1 text-[11px] font-semibold tabular-nums text-slate-700">{value}</p></div>;
}
