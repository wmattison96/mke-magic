import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { GamesTrendChart, WinRatePanel } from "@/components/dashboard/charts";
import { RecentGamesTable } from "@/components/dashboard/tables";
import { Badge, PageHeading, PlayerAvatar, StatCard } from "@/components/ui";
import { players } from "@/data/demo-data";

export function generateStaticParams() { return players.map(({ slug }) => ({ slug })); }

export default async function PlayerProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const player = players.find((entry) => entry.slug === slug);
  if (!player) notFound();
  return <AppShell activePath="/players"><div className="space-y-7">
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><PlayerAvatar initials={player.initials} color={player.color} size="lg"/><div className="min-w-0 flex-1"><p className="mb-1 text-[10px] font-semibold uppercase tracking-[.18em] text-indigo-600">PLAYER PROFILE</p><h1 className="text-2xl font-semibold tracking-tight text-slate-900">{player.name}</h1><p className="mt-1 truncate text-xs text-slate-500">Favorite deck · {player.favoriteDeck}</p></div><Badge tone="green">{player.streak ? `${player.streak} game streak` : "Ready to play"}</Badge></div>
    <section className="grid gap-4 sm:grid-cols-3"><StatCard label="Games played" value={String(player.games)} note="All-time appearances" icon="◷" accent="indigo"/><StatCard label="Games won" value={String(player.wins)} note="Across every deck" icon="♜" accent="teal"/><StatCard label="Win rate" value={`${player.winRate}%`} note="Pod average is 25%" icon="↗" accent="amber"/></section>
    <div className="grid gap-5 xl:grid-cols-[1.3fr_.9fr]"><GamesTrendChart/><WinRatePanel/></div>
    <RecentGamesTable limit={3}/>
  </div></AppShell>;
}
