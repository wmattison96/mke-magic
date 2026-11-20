import { AppShell } from "@/components/app-shell";
import { RecentGamesTable } from "@/components/dashboard/tables";
import { PageHeading, Panel, PlayerAvatar, StatCard } from "@/components/ui";
import { players, recentGames } from "@/data/demo-data";

export default function GamesPage() {
  const avgMinutes = 82;
  return <AppShell activePath="/games"><div className="space-y-7">
    <PageHeading eyebrow="GAME HISTORY" title="Games" description="Every pod, close call, and unexpected comeback in one place." action={<span className="rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-medium text-white shadow-sm">Log a game · soon</span>}/>
    <section className="grid gap-4 sm:grid-cols-3"><StatCard label="Games recorded" value="292" note="Since your first pod" icon="◷" accent="indigo"/><StatCard label="This month" value="12" change="3 games" note="Played in November" icon="▦" accent="teal"/><StatCard label="Average game" value={`${avgMinutes}m`} note="Typical table time" icon="⌛" accent="amber"/></section>
    <RecentGamesTable limit={recentGames.length}/>
    <Panel title="A few nights at the table" subtitle="Recent winners and their winning decks">
      <div className="divide-y divide-slate-100">{recentGames.slice(0, 3).map((game) => { const winner = players.find((player) => player.name === game.winner)!; return <div key={game.date} className="flex flex-wrap items-center gap-3 px-5 py-4 sm:px-6"><PlayerAvatar initials={winner.initials} color={winner.color}/><div className="min-w-[150px] flex-1"><p className="text-xs font-medium text-slate-800">{game.title}</p><p className="mt-1 text-[11px] text-slate-400">{game.date} · {game.duration}</p></div><div className="text-right"><p className="text-[10px] uppercase tracking-wide text-slate-400">Winner</p><p className="mt-1 text-xs font-medium text-slate-700">{game.winner}</p></div></div>; })}</div>
    </Panel>
    <p className="text-center text-[10px] text-slate-400">Demonstration game history · game details are not stored</p>
  </div></AppShell>;
}
