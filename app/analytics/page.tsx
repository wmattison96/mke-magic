import { Suspense } from "react";
import { connection } from "next/server";
import { AppShell } from "@/components/app-shell";
import { AnalyticsFilterBar, type AnalyticsFilterOption } from "@/components/analytics/analytics-filter-bar";
import { AnalyticsSummary, ColorMetagamePanel, CoreFourPanel, SeatAnalysisPanel } from "@/components/analytics/analytics-panels";
import { DeckMatchupExplorer, ExpectedPerformanceExplorer, PlayerMatchupExplorer, PlayerSeatExplorer, TrendExplorer } from "@/components/analytics/analytics-explorer";
import { PageHeading, Panel } from "@/components/ui";
import { getCommanderMetadata } from "@/lib/data/commander-metadata";
import { getPublicProfileData } from "@/lib/data/public-profiles";
import { CORE_FOUR_NAMES, buildAnalyticsPopulation, buildColorAnalysis, buildDeckExpectedPerformance, buildPlayerExpectedPerformance, buildPlayerSeatStats, buildSeatPositionStats, buildAnalyticsTrendSeries, buildAnalyticsTrendDefaults, getQualifiedPlayerComparisons, calculateEloHistory, calculateDeckOpponentMatchups, calculatePlayerSharedMatchups } from "@/lib/stats/analytics";
import { getSiteToday, type DashboardRange } from "@/lib/stats/dashboard";
import { DECK_OPPONENT_DECK_MATCHUP_MINIMUM_GAMES, PLAYER_OPPONENT_DECK_MATCHUP_MINIMUM_GAMES, parsePodFilter } from "@/lib/stats/profiles";

export const instant = false;

type SearchParams = Record<string, string | string[] | undefined>;
const single = (value: string | string[] | undefined) => typeof value === "string" ? value : undefined;

function parseRange(value: string | undefined): DashboardRange {
  return value === "30" || value === "365" ? value : "all";
}

function ErrorState() {
  return <Panel title="Analytics could not load" subtitle="The live playgroup records are temporarily unavailable.">
    <div role="alert" className="px-5 py-8 sm:px-6"><p className="text-sm font-medium text-rose-800">Unable to load analytics from Supabase.</p><p className="mt-2 max-w-2xl text-xs leading-5 text-slate-500">The page does not fall back to sample statistics. Check your connection and reload. If the error continues, review the Supabase read permissions for the public game, participant, player, and deck views.</p></div>
  </Panel>;
}

function LoadingState() {
  return <div className="space-y-5" aria-label="Loading analytics" aria-busy="true"><div className="h-16 animate-pulse rounded-2xl bg-white"/><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map((item) => <div key={item} className="h-28 animate-pulse rounded-2xl bg-white"/>)}</div>{[1, 2, 3].map((item) => <div key={item} className="h-72 animate-pulse rounded-2xl bg-white"/>)}<p className="sr-only">Loading live analytics from the playgroup records.</p></div>;
}

export default function AnalyticsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return <AppShell activePath="/analytics"><Suspense fallback={<LoadingState/>}><AnalyticsLive searchParams={searchParams}/></Suspense></AppShell>;
}

async function AnalyticsLive({ searchParams }: { searchParams: Promise<SearchParams> }) {
  // The current Chicago date and metadata request pacing are request-time values.
  // Keep them behind the route's existing Suspense boundary during prerendering.
  await connection();
  const [query, loaded] = await Promise.all([
    searchParams,
    getPublicProfileData().then((data) => ({ data, error: false as const })).catch(() => ({ data: null, error: true as const })),
  ]);
  if (!loaded.data) return <div className="space-y-6"><PageHeading eyebrow="PATTERNS & TRENDS" title="Analytics" description="Explore how the playgroup’s real games, seats, colors, and decks perform."/><ErrorState/></div>;

  const { games, players, decks } = loaded.data;
  const podFilter = parsePodFilter(single(query.pods));
  const range = parseRange(single(query.range));
  const today = getSiteToday();
  const requestedCoreFour = single(query.coreFour) === "1";
  const population = buildAnalyticsPopulation(games, players, { podFilter, range, today, coreFourOnly: requestedCoreFour });
  const playerElo = calculateEloHistory(population.historyGames, "player");
  const deckElo = calculateEloHistory(population.historyGames, "deck");
  const playerPerformance = buildPlayerExpectedPerformance(population.eligibleGames, players, playerElo);
  const deckPerformance = buildDeckExpectedPerformance(population.eligibleGames, decks, deckElo);
  const activeMembers = new Set(population.recordedGames.flatMap((game) => game.participants.flatMap((participant) => participant.playerId ? [participant.playerId] : []))).size;
  const averagePodSize = population.recordedGames.length
    ? population.recordedGames.reduce((sum, game) => sum + game.podSize, 0) / population.recordedGames.length
    : null;

  const selectedPlayerId = selectId(single(query.player), playerPerformance, "Will");
  const selectedDeckId = selectId(single(query.deck), deckPerformance);
  const playerOptions: AnalyticsFilterOption[] = playerPerformance.map((row) => ({ id: row.id, label: row.name, games: row.games }));
  const deckOptions: AnalyticsFilterOption[] = deckPerformance.map((row) => ({ id: row.id, label: row.name, ownerName: row.ownerName, commanderName: row.commanderName, games: row.games }));
  const playerRows = getQualifiedPlayerComparisons(playerPerformance)
    .map(({ id, name }) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const matchupRows = calculatePlayerSharedMatchups(population.eligibleGames, players);
  const selectedDeck = decks.find((deck) => deck.id === selectedDeckId);
  const deckMatchups = selectedDeck
    ? calculateDeckOpponentMatchups(selectedDeck.id, population.eligibleGames, new Map(decks.map((deck) => [deck.id, deck])))
    : [];
  const playerSeatRows = buildPlayerSeatStats(population.eligibleGames, players);
  const seatRows = buildSeatPositionStats(population.eligibleGames);
  const coreFourRows = buildPlayerExpectedPerformance(population.coreFourEligibleGames, players)
    .filter((row) => CORE_FOUR_NAMES.some((name) => name === row.name));
  const trendSeries = buildAnalyticsTrendSeries(
    population.historyGames,
    players,
    decks,
    playerElo,
    deckElo,
    population.window.startDate,
  );
  const trendDefaults = buildAnalyticsTrendDefaults(trendSeries, playerPerformance, deckPerformance, selectedDeckId);
  const trendPlayerSelectionKey = `${podFilter}:${range}:${population.coreFourOnlyApplied ? "core-four" : "all-members"}:${population.window.startDate ?? "all"}:${population.window.endDate}:${trendDefaults.playerDefaultIds.join(",")}`;
  const commanderMetadata = await getCommanderMetadata(decks);
  const colors = buildColorAnalysis(population.eligibleGames, players, decks, commanderMetadata);
  const rangeLabel = range === "all" ? "All time" : `Last ${range} days`;
  const filtered = population.coreFourOnlyApplied;

  return <div className="space-y-6">
    <PageHeading eyebrow="PATTERNS & TRENDS" title="Analytics" description="Explore how the playgroup’s real games, seats, colors, and decks perform." action={<span className="rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-600 shadow-sm">{rangeLabel} · {podLabel(podFilter)}</span>}/>
    <AnalyticsFilterBar
      podFilter={podFilter}
      range={range}
      coreFourOnly={filtered}
      coreFourAvailable={podFilter === "4"}
      selectedPlayerId={selectedPlayerId}
      selectedDeckId={selectedDeckId}
      players={playerOptions}
      decks={deckOptions}
    />
    {games.length === 0 ? <Panel title="No games have been recorded" subtitle="Once the playgroup logs games, live analytics will appear here."><p className="px-5 py-8 text-xs text-slate-400 sm:px-6">There are no game records to analyze yet.</p></Panel> : <>
      <AnalyticsSummary
        recordedGames={population.recordedGames.length}
        eligibleGames={population.eligibleGames.length}
        memberCount={activeMembers}
        averagePodSize={averagePodSize}
        rangeLabel={rangeLabel}
      />
      {!population.eligibleGames.length && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">No single-winner eligible games match this pod size and date range. Recorded games remain visible in the count; performance panels show empty states.</div>}
      <ExpectedPerformanceExplorer players={playerPerformance} decks={deckPerformance}/>
      <div className="grid gap-5 xl:grid-cols-2">
        <PlayerMatchupExplorer playerId={selectedPlayerId} players={playerRows} rows={matchupRows} minimumGames={PLAYER_OPPONENT_DECK_MATCHUP_MINIMUM_GAMES}/>
        <DeckMatchupExplorer selectedDeck={selectedDeck ? { id: selectedDeck.id, ownerName: selectedDeck.ownerName, name: selectedDeck.name, commanderName: selectedDeck.commanderName } : undefined} rows={deckMatchups} minimumGames={DECK_OPPONENT_DECK_MATCHUP_MINIMUM_GAMES}/>
      </div>
      <TrendExplorer
        playerSeries={trendDefaults.playerSeries}
        deckSeries={trendDefaults.deckSeries}
        defaultPlayerIds={trendDefaults.playerDefaultIds}
        defaultDeckIds={trendDefaults.deckDefaultIds}
        playerSelectionKey={trendPlayerSelectionKey}
        selectedPlayerId={selectedPlayerId}
        selectedDeckId={selectedDeckId}
      />
      <div className="grid gap-5 xl:grid-cols-2"><SeatAnalysisPanel rows={seatRows}/><PlayerSeatExplorer rows={playerSeatRows} selectedPlayerId={selectedPlayerId}/></div>
      <CoreFourPanel rows={coreFourRows} eligibleGames={population.coreFourEligibleGames.length} enabled={podFilter === "4"}/>
      <ColorMetagamePanel analysis={colors}/>
      <p className="text-center text-[10px] leading-5 text-slate-400">All results use public Supabase game records. Games require at least two members and one winner for win statistics; multiplayer shared-pod rates are not head-to-head records. Guest details are not displayed.</p>
    </>}
  </div>;
}

function selectId(requested: string | undefined, rows: Array<{ id: string; games: number; name: string }>, preferredName?: string): string {
  if (requested && rows.some((row) => row.id === requested)) return requested;
  const preferred = preferredName ? rows.find((row) => row.name.toLocaleLowerCase() === preferredName.toLocaleLowerCase()) : undefined;
  return preferred?.id ?? [...rows].sort((a, b) => b.games - a.games || a.name.localeCompare(b.name) || a.id.localeCompare(b.id))[0]?.id ?? "";
}

function podLabel(pod: string) {
  return pod === "3" ? "3-player pods" : pod === "4" ? "4-player pods" : "5+ player pods";
}
