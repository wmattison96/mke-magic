import { GamesTrendChart, WinRatePanel } from "@/components/dashboard/charts";
import { DeckTable, PlayerLeaderboard, RecentGamesTable } from "@/components/dashboard/tables";
import { InsightsPanel } from "@/components/insight-card";
import { PageHeading, StatCard } from "@/components/ui";

export function DashboardHome() {
  return <div className="space-y-7">
    <PageHeading eyebrow="WEDNESDAY POD · COMMANDER" title="Your table, at a glance" description="A living snapshot of the games, players, and decks that make your group yours." action={<span className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-600 shadow-sm">◷ <span>Last 12 months</span><span className="text-slate-400">⌄</span></span>}/>
    <section aria-label="Playgroup overview" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Games played" value="292" change="12.8%" note="vs. previous 12 months" icon="◷" accent="indigo"/>
      <StatCard label="Active players" value="6" note="Played in the last 30 days" icon="♙" accent="teal"/>
      <StatCard label="Registered decks" value="14" change="2 new" note="Across 5 color identities" icon="▤" accent="amber"/>
      <StatCard label="Group win rate" value="25.0%" note="Evenly balanced 4-player pods" icon="↗" accent="rose"/>
    </section>
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,.85fr)]">
      <GamesTrendChart/>
      <WinRatePanel compact/>
    </section>
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(380px,.9fr)]">
      <PlayerLeaderboard/>
      <InsightsPanel/>
    </section>
    <section className="grid gap-5"><RecentGamesTable/></section>
    <DeckTable/>
    <p className="pb-3 text-center text-[10px] text-slate-400">Demonstration data for the Wednesday Pod · not connected to a database</p>
  </div>;
}
