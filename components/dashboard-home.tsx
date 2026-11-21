"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PageHeading, StatCard } from "@/components/ui";
import {
  buildDashboardStats,
  type DashboardRange,
  type StatsGame,
  type StatsPlayer,
} from "@/lib/stats/dashboard";
import {
  CumulativeTrendPanel,
  DeckDiversityPanel,
  DeckRankPanel,
  HotColdPanel,
  PlayerEloPanel,
  PlayerWinRateChart,
  RecentGamesPanel,
} from "@/components/dashboard/dashboard-panels";

const rangeLabels: Record<DashboardRange, string> = {
  all: "All time",
  "365": "Last 365 days",
  "30": "Last 30 days",
};

export function DashboardHome({ games, players, today }: { games: StatsGame[]; players: StatsPlayer[]; today: string }) {
  const [range, setRange] = useState<DashboardRange>("all");
  const stats = useMemo(() => buildDashboardStats(games, players, range, today), [games, players, range, today]);
  const windowLabel = stats.window.endDate;

  return <div className="space-y-6 sm:space-y-7">
    <PageHeading
      eyebrow="FOUR-PLAYER COMMANDER · LIVE RECORDS"
      title="Your table, at a glance"
      description="A clear view of the players, decks, and games in your recorded playgroup history."
      action={<label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-600 shadow-sm"><span aria-hidden="true" className="text-slate-400">◷</span><span className="sr-only">Dashboard date range</span><select value={range} onChange={(event) => setRange(event.target.value as DashboardRange)} className="max-w-[145px] cursor-pointer bg-transparent text-xs font-medium text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-indigo-400" aria-label="Dashboard date range">{Object.entries(rangeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><span aria-hidden="true" className="text-slate-400">⌄</span></label>}
    />

    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-indigo-100 bg-indigo-50/70 px-4 py-3 text-[11px] leading-5 text-indigo-900 sm:px-5">
      <p><span className="font-semibold">Nelson’s recorded historical sample.</span> These figures describe the games in the log, not a complete playgroup census.</p>
      <p className="shrink-0 text-indigo-700">{stats.window.startDate ? `${stats.window.startDate} to ${stats.window.endDate}` : `Through ${stats.window.endDate}`} · 4-player only</p>
    </div>

    <section aria-label="Dashboard overview" className="grid gap-3 sm:grid-cols-3 sm:gap-4">
      <StatCard label="Active players" value={String(stats.activePlayers)} note="Members with an eligible appearance" icon="♙" accent="indigo"/>
      <StatCard label="Games played" value={String(stats.gamesPlayed)} note="4 players · 2+ members · one winner" icon="◷" accent="teal"/>
      <StatCard label="Unique decks played" value={String(stats.uniqueDecksPlayed)} note="Distinct member pilot + commander decks" icon="▤" accent="amber"/>
    </section>

    <section aria-label="Player performance" className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)]">
      <PlayerWinRateChart players={stats.playersByWinRate}/>
      <PlayerEloPanel rankings={stats.playerEloRankings} windowLabel={windowLabel}/>
    </section>

    <p className="-mt-3 text-[10px] leading-5 text-slate-400">Player comparisons and rankings require 10 eligible games in the selected date window. Recent Form compares the last five eligible games; Active Players still counts anyone with an eligible appearance.</p>

    <section aria-label="Top member-owned decks" className="grid gap-5 xl:grid-cols-2">
      <DeckRankPanel decks={stats.topDecksByWinRate} mode="rate"/>
      <DeckRankPanel decks={stats.topDecksByElo} mode="elo"/>
    </section>

    <section aria-label="Deck diversity and recent player form" className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(350px,.95fr)]">
      <DeckDiversityPanel stats={stats}/>
      <HotColdPanel stats={stats}/>
    </section>

    <section aria-label="Recent and cumulative history" className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(350px,.8fr)]">
      <CumulativeTrendPanel stats={stats}/>
      <RecentGamesPanel stats={stats}/>
    </section>

    <p className="pb-2 text-center text-[10px] leading-5 text-slate-400">All Dashboard measures use four-player games with at least two members and exactly one recorded winner. Guest wins count as games and member appearances, never as member wins.</p>
  </div>;
}

export function DashboardLoading() {
  return <div aria-label="Loading Dashboard statistics" aria-busy="true" className="animate-pulse space-y-6">
    <div className="h-24 rounded-2xl bg-white"/>
    <div className="grid gap-3 sm:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="h-32 rounded-2xl bg-white"/>)}</div>
    <div className="grid gap-5 xl:grid-cols-2">{[0, 1].map((item) => <div key={item} className="h-72 rounded-2xl bg-white"/>)}</div>
    <span className="sr-only">Loading live statistics…</span>
  </div>;
}

export function DashboardLoadError() {
  return <section role="alert" className="rounded-2xl border border-rose-200 bg-white p-6 shadow-sm sm:p-8">
    <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-rose-700">Dashboard unavailable</p>
    <h2 className="mt-2 text-lg font-semibold text-slate-900">We couldn’t load the live playgroup records.</h2>
    <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">No demonstration statistics are shown. Refresh to try the database again, or open Games to check the live history directly.</p>
    <div className="mt-5 flex flex-wrap gap-3"><Link href="/" className="rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-medium text-white hover:bg-indigo-700">Retry</Link><Link href="/games" className="rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50">Open Games</Link></div>
  </section>;
}
