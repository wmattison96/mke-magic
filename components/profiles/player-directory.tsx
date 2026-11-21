import Link from "next/link";
import { PageHeading } from "@/components/ui";
import { formatRate, PlayerPortrait, PodFilter, ScopeNote } from "@/components/profiles/primitives";
import type { PlayerProfileStats, PodFilter as PodSize } from "@/lib/stats/profiles";

export interface PlayerDirectoryEntry {
  stats: PlayerProfileStats;
  commanderArtwork: string | null;
}

export function PlayerDirectory({ entries, podFilter, recordedGames, participationGames, winGames }: {
  entries: PlayerDirectoryEntry[];
  podFilter: PodSize;
  recordedGames: number;
  participationGames: number;
  winGames: number;
}) {
  return <div className="space-y-7">
    <PageHeading eyebrow="THE REGULARS" title="Players" description="Explore each member’s recorded play history, eligible performance, and decks across the playgroup." action={<span className="rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-medium text-white shadow-sm">{entries.length} members</span>}/>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><PodFilter value={podFilter} basePath="/players"/><ScopeNote value={podFilter} recordedGames={recordedGames} participationGames={participationGames} winGames={winGames}/></div>
    <section aria-label="Playgroup member profiles" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {entries.map(({ stats, commanderArtwork }) => {
        const player = stats.player;
        const isRankedSample = stats.meetsComparisonMinimum;
        return <Link key={player.id} href={`/players/${player.id}?pods=${podFilter}`} className="group flex min-h-[170px] flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,.025)] transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-300">
          <div className="flex items-center gap-3.5"><PlayerPortrait name={player.name} artwork={commanderArtwork} size="lg"/><div className="min-w-0 flex-1"><h2 className="truncate text-base font-semibold text-slate-900 group-hover:text-indigo-700">{player.name}</h2><p className="mt-1 truncate text-[10px] text-slate-400">{stats.mostPlayedDeck?.name ?? "No eligible deck yet"}</p></div><span className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-500">↗</span></div>
          <div className="mt-5 grid grid-cols-3 gap-3 border-t border-slate-100 pt-4">
            <div><p className="text-[9px] uppercase tracking-[.12em] text-slate-400">Win rate</p><p className="mt-1 text-sm font-semibold tabular-nums text-slate-800">{isRankedSample ? formatRate(stats.totals.winRate) : "N/A"}</p></div>
            <div><p className="text-[9px] uppercase tracking-[.12em] text-slate-400">Provisional Elo</p><p className="mt-1 text-sm font-semibold tabular-nums text-slate-800">{!isRankedSample || stats.elo === null ? "N/A" : stats.elo}</p></div>
            <div><p className="text-[9px] uppercase tracking-[.12em] text-slate-400">Eligible games</p><p className="mt-1 text-sm font-semibold tabular-nums text-slate-800">{stats.totals.winEligibleGames}</p></div>
          </div>
          <p className="mt-3 text-[9px] leading-4 text-slate-400">{isRankedSample ? `${stats.totals.wins} wins · ${stats.totals.participationEligibleAppearances} 2+ member appearances` : `Small sample · need ${Math.max(0, 10 - stats.totals.winEligibleGames)} more eligible game${10 - stats.totals.winEligibleGames === 1 ? "" : "s"} for comparison`}</p>
        </Link>;
      })}
    </section>
    <p className="text-center text-[10px] leading-5 text-slate-400">Cards are members from the approved roster. Competitive win-rate comparisons require 10 eligible games; lower samples remain available on each profile.</p>
  </div>;
}
