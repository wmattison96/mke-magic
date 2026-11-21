import { AppShell } from "@/components/app-shell";
import { PlayerLeaderboard } from "@/components/dashboard/tables";
import { PageHeading, StatCard } from "@/components/ui";
import { players } from "@/data/demo-data";

export default function PlayersPage() {
  const games = players.reduce((sum, player) => sum + player.games, 0);
  return <AppShell activePath="/players"><div className="space-y-7">
    <PageHeading eyebrow="THE REGULARS" title="Players" description="Meet the people behind the plays. Select a player to see their profile and table history." action={<span className="rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-medium text-white shadow-sm">6 players</span>}/>
    <section className="grid gap-4 sm:grid-cols-3"><StatCard label="Players in the pod" value="6" note="All-time roster" icon="♙" accent="indigo"/><StatCard label="Games logged" value={String(games)} note="Across all player records" icon="◷" accent="teal"/><StatCard label="Top win rate" value="35.7%" note="Will · 15 wins" icon="↗" accent="amber"/></section>
    <PlayerLeaderboard/>
    <p className="text-center text-[10px] text-slate-400">Sample player statistics · individual profiles are demonstration pages</p>
  </div></AppShell>;
}
