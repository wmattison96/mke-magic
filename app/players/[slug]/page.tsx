import { notFound } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ColorBreakdownPanel, PlayerTrendPanels, SeatPerformancePanel } from "@/components/profiles/charts";
import { CompetitiveRankBadge, OpponentDeckMatchupPanel, PlayerCareerPanel, PlayerDeckTable, PlayerOpponentsPanel } from "@/components/profiles/player-detail-panels";
import { MoxfieldEditor } from "@/components/profiles/moxfield-editor";
import { PlayerPortrait, PodFilter, ProfileGameList, ScopeNote, formatRate } from "@/components/profiles/primitives";
import { StatCard } from "@/components/ui";
import { getCommanderMetadata } from "@/lib/data/commander-metadata";
import { getPublicProfileData } from "@/lib/data/public-profiles";
import { buildProfileStatistics, parsePodFilter, PLAYER_OPPONENT_DECK_MATCHUP_MINIMUM_GAMES } from "@/lib/stats/profiles";
import { getCurrentMemberContext } from "@/lib/supabase/verified-user";

export const instant = false;

export default async function PlayerProfilePage({ params, searchParams }: {
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
  const initial = buildProfileStatistics(data.games, data.players, data.decks, podFilter);
  const preview = initial.players.get(slug);
  if (!preview) notFound();
  const ownedDecks = data.decks.filter((deck) => deck.ownerId === slug);
  const metadata = await getCommanderMetadata(ownedDecks);
  const profiles = buildProfileStatistics(data.games, data.players, data.decks, podFilter, metadata);
  const stats = profiles.players.get(slug);
  if (!stats) notFound();
  const artwork = stats.mostPlayedDeck ? metadata.get(stats.mostPlayedDeck.commanderId)?.artUrl ?? null : null;
  const canEdit = memberContext?.approvalStatus === "approved" && (memberContext.role === "admin" || memberContext.playerId === stats.player.id);
  const sampleNote = stats.meetsComparisonMinimum
    ? `${stats.totals.winEligibleGames} eligible games in this sample.`
    : `Small sample: ${stats.totals.winEligibleGames} eligible games; player comparisons start at 10.`;

  return <AppShell activePath="/players"><div className="space-y-6">
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,.025)] sm:flex-row sm:items-center sm:p-6">
      <PlayerPortrait name={stats.player.name} artwork={artwork} size="lg"/>
      <div className="min-w-0 flex-1"><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-indigo-600">PLAYER PROFILE</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{stats.player.name}</h1><p className="mt-1 truncate text-xs text-slate-500">Most played eligible deck · {stats.mostPlayedDeck ? <Link href={`/decks/${stats.mostPlayedDeck.id}?pods=${podFilter}`} className="font-medium text-indigo-600 hover:text-indigo-800">{stats.mostPlayedDeck.name}</Link> : "N/A"}</p><p className="mt-2 text-[10px] text-slate-400">{sampleNote}</p></div>
      <div className="flex flex-col items-start gap-2 sm:items-end"><CompetitiveRankBadge rank={stats.competitiveRank} meetsMinimum={stats.meetsComparisonMinimum}/><MoxfieldEditor type="player" recordId={stats.player.id} initialUrl={stats.player.moxfieldUrl ?? null} canEdit={canEdit}/></div>
    </div>

    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><PodFilter value={podFilter} basePath={`/players/${slug}`}/><ScopeNote value={podFilter} recordedGames={profiles.totalGamesInPod} participationGames={profiles.participationEligibleGames} winGames={profiles.winEligibleGames}/></div>
    <p className="-mt-3 px-1 text-[10px] leading-5 text-slate-400">This player has {stats.totals.recordedAppearances} recorded appearances in this pod-size dataset. The official eligible-appearance count applies the 2+ member gate; win rate and Elo use only single-winner results. {podFilter === "5plus" ? "Each expected-win baseline uses the actual pod size." : ""}</p>

    <section aria-label="Player performance summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Eligible appearances" value={String(stats.totals.participationEligibleAppearances)} note={`${stats.totals.recordedAppearances} total recorded · 2+ member gate`} icon="◷" accent="indigo"/>
      <StatCard label="Wins" value={String(stats.totals.wins)} note={`${stats.totals.winEligibleGames} single-winner eligible games`} icon="♜" accent="teal"/>
      <StatCard label="Win rate" value={formatRate(stats.totals.winRate)} note={stats.totals.winEligibleGames ? `${stats.totals.wins} wins / ${stats.totals.winEligibleGames} games${stats.meetsComparisonMinimum ? "" : " · small sample"}` : "N/A · no eligible results"} icon="↗" accent="amber"/>
      <StatCard label="Provisional Elo" value={stats.elo === null ? "N/A" : String(stats.elo)} note={`${stats.eloGames} rated eligible appearances${stats.elo !== null && !stats.meetsComparisonMinimum ? " · exploratory sample" : ""}`} icon="⌁" accent="rose"/>
    </section>
    <section aria-label="Player history summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Distinct decks played" value={String(stats.distinctDecksPlayed)} note="Member-owned deck identities" icon="▤" accent="indigo"/>
      <StatCard label="Competitive rank" value={stats.competitiveRank === null ? "N/A" : `#${stats.competitiveRank}`} note="Raw win rate · minimum 10 games" icon="№" accent="teal"/>
      <StatCard label="Peak Elo" value={stats.peakElo === null ? "N/A" : String(stats.peakElo)} note="After first eligible appearance" icon="↗" accent="amber"/>
      <StatCard label="Lowest Elo" value={stats.minimumElo === null ? "N/A" : String(stats.minimumElo)} note="After first eligible appearance" icon="↘" accent="rose"/>
    </section>

    <PlayerTrendPanels points={stats.trends} expectedWinRate={stats.expectedWinRate}/>
    <div className="grid gap-5 xl:grid-cols-2"><SeatPerformancePanel seats={stats.seats}/><PlayerCareerPanel wins={stats.streaks.longestWins} losses={stats.streaks.longestLosses} peakElo={stats.peakElo} minimumElo={stats.minimumElo} elo={stats.elo} eloGames={stats.eloGames} comparisonMinimum={stats.meetsComparisonMinimum}/></div>
    <div className="grid gap-5 xl:grid-cols-2"><ColorBreakdownPanel title="Color identity across distinct decks" breakdown={stats.colorsByDeck} basis="decks"/><ColorBreakdownPanel title="Color identity across eligible appearances" breakdown={stats.colorsByGame} basis="appearances"/></div>
    <PlayerDeckTable decks={stats.decks} podFilter={podFilter}/>
    <div className="grid gap-5 xl:grid-cols-2"><PlayerOpponentsPanel opponents={stats.opponents} podFilter={podFilter}/><OpponentDeckMatchupPanel title="Most Commonly Faced Decks" rows={stats.mostFacedDecks} podFilter={podFilter} mode="most-faced" subjectLabel="player" minimumSharedGames={PLAYER_OPPONENT_DECK_MATCHUP_MINIMUM_GAMES}/></div>
    <div className="grid gap-5 xl:grid-cols-2"><OpponentDeckMatchupPanel title="Best Matchups" rows={stats.bestMatchups} podFilter={podFilter} mode="matchup" subjectLabel="player" minimumSharedGames={PLAYER_OPPONENT_DECK_MATCHUP_MINIMUM_GAMES}/><OpponentDeckMatchupPanel title="Toughest Matchups" rows={stats.toughestMatchups} podFilter={podFilter} mode="matchup" subjectLabel="player" minimumSharedGames={PLAYER_OPPONENT_DECK_MATCHUP_MINIMUM_GAMES}/></div>
    <section className="rounded-xl border border-slate-200/80 bg-white"><div className="border-b border-slate-100 px-5 py-4 sm:px-6"><h2 className="text-sm font-semibold text-slate-800">Recent game history</h2><p className="mt-1 text-xs text-slate-400">Most recent recorded appearances, including games outside official win statistics</p></div><ProfileGameList games={stats.recentGames}/></section>
    <p className="text-center text-[10px] leading-5 text-slate-400">Matchup rates are player wins divided by eligible shared pods containing that member-owned opposing deck. Guest wins remain in the denominator without counting as player wins. These are multiplayer shared pods, not one-on-one matches.</p>
  </div></AppShell>;
}
