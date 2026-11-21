import { notFound } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { DeckQuadrantPanel, DeckTrendPanel, SeatPerformancePanel } from "@/components/profiles/charts";
import { OpponentDeckPanel } from "@/components/profiles/player-detail-panels";
import { MoxfieldEditor } from "@/components/profiles/moxfield-editor";
import { CommanderArt, PodFilter, ProfileGameList, ScopeNote, formatRate } from "@/components/profiles/primitives";
import { StatCard } from "@/components/ui";
import { getCommanderMetadata } from "@/lib/data/commander-metadata";
import { getPublicProfileData } from "@/lib/data/public-profiles";
import { buildProfileStatistics, parsePodFilter } from "@/lib/stats/profiles";
import { getCurrentMemberContext } from "@/lib/supabase/verified-user";

export const instant = false;

function colorLabel(colors: string[] | null): string {
  if (colors === null) return "Color identity not resolved";
  return colors.length ? colors.join(" · ") : "Colorless";
}

export default async function DeckProfilePage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug }, query, data, memberContext] = await Promise.all([
    params,
    searchParams,
    getPublicProfileData(),
    getCurrentMemberContext(),
  ]);
  const podFilter = parsePodFilter(query.pods);
  const baseProfiles = buildProfileStatistics(data.games, data.players, data.decks, podFilter);
  const preview = baseProfiles.decks.get(slug);
  if (!preview) notFound();
  const metadata = await getCommanderMetadata([preview.deck]);
  const profiles = buildProfileStatistics(data.games, data.players, data.decks, podFilter, metadata);
  const stats = profiles.decks.get(slug);
  if (!stats) notFound();
  const deck = stats.deck;
  const canEdit = memberContext?.approvalStatus === "approved" && (memberContext.role === "admin" || memberContext.playerId === deck.ownerId);
  const smallSample = stats.totals.winEligibleGames < 5;

  return <AppShell activePath="/decks"><div className="space-y-6">
    <div className="grid gap-5 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,.025)] sm:grid-cols-[180px_1fr] sm:items-center sm:p-6">
      <CommanderArt name={deck.commanderName} artwork={stats.commanderMetadata.artUrl} className="aspect-[.72] w-full max-w-[180px] justify-self-center sm:justify-self-start"/>
      <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-indigo-600">MEMBER DECK PROFILE</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{deck.name}</h1><p className="mt-1 text-sm text-slate-600">{deck.commanderName}</p><p className="mt-2 text-xs text-slate-400">Owner · <Link href={`/players/${deck.ownerId}?pods=${podFilter}`} className="font-medium text-indigo-600 hover:text-indigo-800">{deck.ownerName}</Link></p><p className="mt-1 text-[10px] text-slate-400">Color identity · {colorLabel(stats.commanderMetadata.colors)}</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1"><MoxfieldEditor type="deck" recordId={deck.id} initialUrl={deck.moxfieldUrl} canEdit={canEdit}/><span className="text-[9px] text-slate-400">Deck identity is this owner + commander configuration.</span></div>
        {smallSample && <p className="mt-3 inline-flex rounded-lg bg-amber-50 px-3 py-2 text-[10px] leading-4 text-amber-800">Small sample · {stats.totals.winEligibleGames} eligible games; deck rankings require 5.</p>}
      </div>
    </div>

    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><PodFilter value={podFilter} basePath={`/decks/${slug}`}/><ScopeNote value={podFilter} recordedGames={profiles.totalGamesInPod} participationGames={profiles.participationEligibleGames} winGames={profiles.winEligibleGames}/></div>
    <p className="-mt-3 px-1 text-[10px] leading-5 text-slate-400">This deck has {stats.totals.recordedAppearances} recorded appearances in this pod-size dataset. Official win rates and Elo use the {stats.totals.winEligibleGames} single-winner results with at least two members.</p>

    <section aria-label="Deck performance summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Eligible games" value={String(stats.totals.winEligibleGames)} note={`${stats.totals.participationEligibleAppearances} 2+ member appearances · ${stats.totals.recordedAppearances} recorded`} icon="◷" accent="indigo"/>
      <StatCard label="Wins" value={String(stats.totals.wins)} note="Victories by the deck's member pilot" icon="♜" accent="teal"/>
      <StatCard label="Win rate" value={formatRate(stats.totals.winRate)} note={stats.totals.winEligibleGames ? `${stats.totals.wins} wins / ${stats.totals.winEligibleGames} games${smallSample ? " · small sample" : ""}` : "N/A · no eligible results"} icon="↗" accent="amber"/>
      <StatCard label="Provisional deck Elo" value={stats.elo === null ? "N/A" : String(stats.elo)} note={`${stats.eloGames} eligible appearances${smallSample && stats.elo !== null ? " · exploratory sample" : ""}`} icon="⌁" accent="rose"/>
    </section>

    <DeckQuadrantPanel points={stats.quadrantPoints} selectedDeckId={deck.id} medianGames={stats.quadrantMedianGames} expectedWinRate={stats.quadrantExpectedWinRate}/>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,.85fr)]"><DeckTrendPanel points={stats.trends}/><SeatPerformancePanel seats={stats.seats} title="Deck seat-order performance"/></div>
    <div className="grid gap-5 xl:grid-cols-3"><OpponentDeckPanel title="Most commonly faced" rows={stats.mostFacedDecks} podFilter={podFilter} mode="faced"/><OpponentDeckPanel title="Most decks beaten" rows={stats.mostBeatenDecks} podFilter={podFilter} mode="beaten"/><OpponentDeckPanel title="Most losses to" rows={stats.mostLostToDecks} podFilter={podFilter} mode="lost-to"/></div>
    <p className="-mt-4 px-1 text-[10px] leading-5 text-slate-400">Opponent-deck records are shared-pod context, not one-on-one matches. A member-owned opposing deck is credited with a loss only when its pilot won; a guest win remains a deck loss with no member-deck attribution.</p>
    <section className="rounded-xl border border-slate-200/80 bg-white"><div className="border-b border-slate-100 px-5 py-4 sm:px-6"><h2 className="text-sm font-semibold text-slate-800">Recent matches</h2><p className="mt-1 text-xs text-slate-400">Most recent recorded appearances, including excluded and exceptional games</p></div><ProfileGameList games={stats.recentGames}/></section>
  </div></AppShell>;
}
