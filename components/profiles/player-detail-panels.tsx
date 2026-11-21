"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge, Panel } from "@/components/ui";
import { MiniStat, formatRate } from "@/components/profiles/primitives";
import type { DeckPerformance, OpponentDeckStat, PlayerOpponentStat } from "@/lib/stats/profiles";

export function PlayerDeckTable({ decks, podFilter }: { decks: DeckPerformance[]; podFilter: "3" | "4" | "5plus" }) {
  const [sort, setSort] = useState<"games" | "rate">("games");
  const rows = useMemo(() => [...decks].sort((a, b) => {
    if (sort === "rate") {
      const aQualified = a.winEligibleGames >= 4;
      const bQualified = b.winEligibleGames >= 4;
      if (aQualified !== bQualified) return aQualified ? -1 : 1;
      if (aQualified && bQualified) return (b.winRate ?? -1) - (a.winRate ?? -1) || b.winEligibleGames - a.winEligibleGames;
    }
    return b.participationEligibleAppearances - a.participationEligibleAppearances || a.name.localeCompare(b.name);
  }), [decks, sort]);
  return <Panel title="Decks played" subtitle="Rate ordering includes a 4 single-winner game minimum; all decks stay listed" action={<label className="flex items-center gap-2 text-[10px] text-slate-500">Sort<select value={sort} onChange={(event) => setSort(event.target.value as "games" | "rate")} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5"><option value="games">Play count</option><option value="rate">Win rate</option></select></label>}>
    {!rows.length ? <p className="px-5 py-7 text-xs text-slate-400 sm:px-6">No member-owned decks are registered for this player.</p> : <div className="divide-y divide-slate-100">
      {rows.map((deck) => {
        const qualified = deck.winEligibleGames >= 4;
        return <div key={deck.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-5 py-3.5 sm:grid-cols-[minmax(0,1.8fr)_minmax(90px,.7fr)_minmax(80px,.6fr)_minmax(75px,.6fr)] sm:px-6">
          <Link href={`/decks/${deck.id}?pods=${podFilter}`} className="min-w-0"><span className="block truncate text-xs font-medium text-slate-800 hover:text-indigo-700">{deck.name}</span><span className="mt-1 block truncate text-[9px] text-slate-400">{deck.commanderName}</span></Link>
          <span className="text-right text-[10px] tabular-nums text-slate-500 sm:text-left">{deck.winEligibleGames} eligible games</span>
          <span className="text-right text-[10px] tabular-nums text-slate-500">{deck.wins} wins</span>
          <span className="col-span-2 text-right sm:col-span-1 sm:text-left"><span className="text-[10px] font-semibold tabular-nums text-slate-700">{qualified ? formatRate(deck.winRate) : "N/A"}</span>{!qualified && <span className="ml-2 text-[8px] text-slate-400">need 4</span>}</span>
        </div>;
      })}
    </div>}
  </Panel>;
}

export function PlayerOpponentsPanel({ opponents, podFilter }: { opponents: PlayerOpponentStat[]; podFilter: "3" | "4" | "5plus" }) {
  return <Panel title="Shared-game records" subtitle="Games where both members appeared; third-party winners are possible">
    {!opponents.length ? <p className="px-5 py-7 text-xs text-slate-400 sm:px-6">No eligible shared pods with another registered member yet.</p> : <div className="divide-y divide-slate-100">
      {opponents.map((opponent) => <div key={opponent.playerId} className="flex items-center justify-between gap-3 px-5 py-3.5 sm:px-6"><Link href={`/players/${opponent.playerId}?pods=${podFilter}`} className="min-w-0 truncate text-xs font-medium text-slate-700 hover:text-indigo-700">{opponent.name}</Link><span className="shrink-0 text-right text-[10px] tabular-nums text-slate-500">{opponent.sharedGames} shared · {opponent.wins} wins · {formatRate(opponent.winRate)}<span className="ml-2 text-[8px] text-slate-400">{opponent.sharedGames < 10 ? "small sample" : ""}</span></span></div>)}
      <p className="px-5 py-3 text-[9px] leading-4 text-slate-400 sm:px-6">These are shared pods, not one-on-one matches. Each rate is this player’s wins divided by shared single-winner eligible games.</p>
    </div>}
  </Panel>;
}

export function OpponentDeckPanel({ title, rows, podFilter, mode = "both" }: { title: string; rows: OpponentDeckStat[]; podFilter: "3" | "4" | "5plus"; mode?: "both" | "faced" | "beaten" | "lost-to" }) {
  const subtitle = mode === "beaten" ? "Member-owned decks defeated in eligible shared pods"
    : mode === "lost-to" ? "Member-owned decks whose pilot won against this deck"
      : "Member-owned decks appearing in the same eligible pods";
  return <Panel title={title} subtitle={subtitle} className="min-w-0">
    {!rows.length ? <p className="px-5 py-6 text-xs text-slate-400 sm:px-6">None in this sample.</p> : <ul className="divide-y divide-slate-100">{rows.map((row) => {
      const outcome = mode === "beaten" ? `${row.winsAgainst} wins` : mode === "lost-to" ? `${row.lossesTo} losses` : `${row.winsAgainst} wins · ${row.lossesTo} losses`;
      return <li key={row.deckId}><Link href={`/decks/${row.deckId}?pods=${podFilter}`} className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-slate-50 sm:px-6"><span className="min-w-0"><span className="block truncate text-xs font-medium text-slate-700">{row.name}</span><span className="mt-1 block truncate text-[9px] text-slate-400">{row.ownerName} · {row.games} shared pods</span></span><span className="shrink-0 text-right text-[10px] tabular-nums text-slate-500">{outcome}<span className="block text-[8px] text-slate-400">{mode === "lost-to" ? `${row.lossesTo}/${row.games} losses` : `${formatRate(row.winRate)} win share`}{row.games < 10 ? " · small sample" : ""}</span></span></Link></li>;
    })}</ul>}
  </Panel>;
}

export function PlayerCareerPanel({ wins, losses, peakElo, minimumElo, elo, eloGames, comparisonMinimum }: {
  wins: number; losses: number; peakElo: number | null; minimumElo: number | null; elo: number | null; eloGames: number; comparisonMinimum: boolean;
}) {
  return <Panel title="Career markers" subtitle="Streaks and Elo extrema start at the first eligible appearance">
    <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 sm:p-5">
      <MiniStat label="Longest win streak" value={String(wins)}/><MiniStat label="Longest loss streak" value={String(losses)}/><MiniStat label="Current provisional Elo" value={elo === null ? "N/A" : String(elo)} note={`${eloGames} appearances${!comparisonMinimum && elo !== null ? " · small sample" : ""}`}/><MiniStat label="Peak Elo" value={peakElo === null ? "N/A" : String(peakElo)}/><MiniStat label="Lowest Elo" value={minimumElo === null ? "N/A" : String(minimumElo)}/>
    </div>
  </Panel>;
}

export function CompetitiveRankBadge({ rank, meetsMinimum }: { rank: number | null; meetsMinimum: boolean }) {
  return rank !== null && meetsMinimum ? <Badge tone="blue">Eligible rank #{rank}</Badge> : <Badge tone="amber">Small sample · not ranked</Badge>;
}
