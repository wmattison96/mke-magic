"use client";

import Link from "next/link";
import type { DashboardStats, DeckStat, PlayerStat } from "@/lib/stats/dashboard";
import { Badge, Panel, PlayerAvatar } from "@/components/ui";

const playerColors: Record<string, string> = {
  will: "#6476d9",
  manfred: "#d18457",
  josh: "#459b88",
  nelson: "#5984c5",
  sam: "#bd6680",
  keenan: "#b4933e",
};
const donutColors = ["#5b65cf", "#0f9d90", "#dd8b4d", "#bd5c78", "#4d86c5", "#8594a8"];

function colorFor(playerName: string) {
  return playerColors[playerName.toLocaleLowerCase()] ?? "#6b7280";
}

function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
}

function displayPercent(value: number | null) {
  return value === null ? "N/A" : `${(value * 100).toFixed(1)}%`;
}

export function PlayerWinRateChart({ players }: { players: PlayerStat[] }) {
  return <Panel title="Player win rate" subtitle="Eligible games · 25% is an even share · 10-game minimum">
    {players.length === 0 ? <EmptyChart message="No member has 10 eligible games in this date range yet."/> : <div className="space-y-4 px-5 py-5 sm:px-6">
      <div className="grid grid-cols-[minmax(76px,100px)_1fr_72px] gap-3 text-[9px] font-medium uppercase tracking-wide text-slate-400 sm:grid-cols-[minmax(94px,130px)_1fr_84px]">
        <span>Member</span><div className="relative flex justify-between"><span>0%</span><span>50%</span><span>100%</span><i aria-hidden="true" className="absolute bottom-[-6px] left-1/4 top-[-2px] border-l border-dashed border-indigo-400"/></div><span className="text-right">Wins / games</span>
      </div>
      <div className="space-y-3">
        {players.map((player) => <div key={player.id} className="group grid grid-cols-[minmax(76px,100px)_1fr_72px] items-center gap-3 sm:grid-cols-[minmax(94px,130px)_1fr_84px]">
          <Link href={`/players/${player.id}`} className="flex min-w-0 items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-indigo-400" aria-label={`Open ${player.name}'s profile`}>
            <PlayerAvatar initials={initials(player.name)} color={colorFor(player.name)} size="sm"/><span className="truncate text-[11px] font-medium text-slate-700 group-hover:text-indigo-700">{player.name}</span>
          </Link>
          <div className="relative h-3.5 rounded-full bg-slate-100" role="img" aria-label={`${player.name}: ${displayPercent(player.winRate)}, ${player.wins} wins in ${player.games} eligible games`}>
            <span aria-hidden="true" className="absolute bottom-0 left-1/4 top-0 z-10 border-l border-dashed border-indigo-400"/>
            <span className="block h-full rounded-full bg-gradient-to-r from-indigo-400 to-indigo-600 transition-[width]" style={{ width: `${Math.max(0, Math.min(100, (player.winRate ?? 0) * 100))}%` }} />
            <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-[10px] text-white shadow-lg group-hover:block group-focus-within:block">{displayPercent(player.winRate)} · {player.wins} wins / {player.games} games</span>
          </div>
          <span className="text-right text-[10px] tabular-nums text-slate-500">{player.wins} / {player.games}</span>
        </div>)}
      </div>
      <div className="flex items-center gap-2 border-t border-slate-100 pt-3 text-[10px] text-slate-500"><span className="inline-block h-3 border-l border-dashed border-indigo-500"/> 25% expected-win reference <span className="ml-auto">Hover a bar for sample details</span></div>
    </div>}
  </Panel>;
}

export function PlayerEloPanel({ rankings, windowLabel }: { rankings: PlayerStat[]; windowLabel: string }) {
  const max = Math.max(1, ...rankings.map((player) => player.elo ?? 0));
  const min = Math.min(1000, ...rankings.map((player) => player.elo ?? 1000));
  return <Panel title="Player Elo" subtitle={`10 eligible games in this window · rating as of ${windowLabel}`} action={<Badge tone="amber">PROVISIONAL</Badge>}>
    {rankings.length === 0 ? <EmptyChart message="No member has 10 eligible games in this date range yet."/> : <ol className="space-y-3 px-5 py-5 sm:px-6">
      {rankings.map((player, index) => {
        const rating = player.elo ?? 1000;
        const scaleMin = Math.min(900, min);
        const scaleMax = Math.max(1100, max);
        const width = Math.max(4, Math.min(100, ((rating - scaleMin) / (scaleMax - scaleMin)) * 100));
        return <li key={player.id} className="group grid grid-cols-[25px_minmax(72px,1fr)_minmax(75px,1.3fr)_48px] items-center gap-2 sm:grid-cols-[28px_1fr_1.5fr_54px]">
          <span className="text-[10px] font-semibold tabular-nums text-slate-400">{String(index + 1).padStart(2, "0")}</span>
          <Link href={`/players/${player.id}`} className="truncate text-[11px] font-medium text-slate-700 hover:text-indigo-700">{player.name}</Link>
          <div className="relative h-2 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${player.name}: provisional Elo ${rating}, ${player.eloGames} games counted`}>
            <span className="block h-full rounded-full bg-gradient-to-r from-teal-300 to-teal-600" style={{ width: `${width}%` }}/>
            <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-[10px] text-white shadow-lg group-hover:block">{player.eloGames} eligible appearances counted</span>
          </div>
          <span className="text-right text-xs font-semibold tabular-nums text-slate-700">{rating}</span>
        </li>;
      })}
      <li className="border-t border-slate-100 pt-3 text-[10px] text-slate-400">Rating uses all eligible history through the selected window end. Games counted show rating sample size.</li>
    </ol>}
  </Panel>;
}

export function DeckRankPanel({ decks, mode }: { decks: DeckStat[]; mode: "rate" | "elo" }) {
  const isElo = mode === "elo";
  return <Panel title={isElo ? "Top decks by provisional Elo" : "Top decks by win rate"} subtitle={isElo ? "At least 5 games in the selected window · rating as of period end" : "At least 5 eligible games in the selected window"} action={isElo ? <Badge tone="amber">PROVISIONAL</Badge> : undefined}>
    {decks.length === 0 ? <EmptyChart message={isElo ? "No deck has 5 eligible games in this window yet." : "No deck reaches the 5-game minimum in this window."}/> : <ol className="divide-y divide-slate-100">
      {decks.map((deck, index) => <li key={deck.id} className="flex items-center gap-3 px-5 py-3.5 sm:px-6">
        <span className="w-5 text-[10px] font-semibold tabular-nums text-slate-400">{index + 1}</span>
        <div className="min-w-0 flex-1"><Link href={`/decks/${deck.id}`} className="block truncate text-xs font-semibold text-slate-700 hover:text-indigo-700">{deck.name}</Link><p className="mt-1 truncate text-[10px] text-slate-400">{deck.ownerName} · {deck.games} games · {deck.wins} wins</p></div>
        <div className="text-right"><p className="text-sm font-semibold tabular-nums text-slate-800">{isElo ? deck.elo : displayPercent(deck.winRate)}</p><p className="mt-0.5 text-[9px] text-slate-400">{isElo ? `${deck.eloGames} Elo games` : "win rate"}</p></div>
      </li>)}
    </ol>}
  </Panel>;
}

export function DeckDiversityPanel({ stats }: { stats: DashboardStats }) {
  const total = stats.uniqueDecksPlayed;
  const radius = 33;
  const circumference = 2 * Math.PI * radius;
  return <Panel title="Deck diversity" subtitle="Share of distinct member-owned decks by pilot">
    {stats.deckDiversity.length === 0 ? <EmptyChart message="No member-owned decks appear in eligible games for this range."/> : <div className="grid gap-5 p-5 sm:grid-cols-[minmax(130px,.75fr)_1fr] sm:items-center sm:px-6">
      <div className="mx-auto relative aspect-square w-full max-w-[178px]">
        <svg viewBox="0 0 100 100" className="size-full -rotate-90" role="img" aria-label={`Distribution of ${total} unique eligible member-owned decks by owner`}>
          <circle cx="50" cy="50" r={radius} fill="none" stroke="#eef2f7" strokeWidth="13"/>
          {stats.deckDiversity.map((owner, index) => {
            const length = owner.share * circumference;
            const offsetBefore = stats.deckDiversity.slice(0, index).reduce((sum, previous) => sum + previous.share * circumference, 0);
            return <circle key={owner.ownerId} cx="50" cy="50" r={radius} fill="none" stroke={donutColors[index % donutColors.length]} strokeWidth="13" strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-offsetBefore}>
              <title>{`${owner.ownerName}: ${owner.deckCount} of ${total} unique decks (${(owner.share * 100).toFixed(1)}%)`}</title>
            </circle>;
          })}
          <text x="50" y="47" textAnchor="middle" className="fill-slate-800" transform="rotate(90 50 50)" fontSize="14" fontWeight="700">{total}</text>
          <text x="50" y="59" textAnchor="middle" className="fill-slate-400" transform="rotate(90 50 50)" fontSize="5">UNIQUE DECKS</text>
        </svg>
      </div>
      <ul className="space-y-2.5">
        {stats.deckDiversity.map((owner, index) => <li key={owner.ownerId} className="flex items-center justify-between gap-2 text-[11px]">
          <Link href={`/players/${owner.ownerId}`} className="flex min-w-0 items-center gap-2 text-slate-600 hover:text-indigo-700"><span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: donutColors[index % donutColors.length] }}/><span className="truncate">{owner.ownerName}</span></Link><span className="shrink-0 font-medium tabular-nums text-slate-500">{owner.deckCount} <span className="text-slate-400">· {(owner.share * 100).toFixed(1)}%</span></span>
        </li>)}
      </ul>
    </div>}
  </Panel>;
}

export function HotColdPanel({ stats }: { stats: DashboardStats }) {
  const hasData = stats.hotPlayers.length > 0;
  return <Panel title="Recent form" subtitle={`Last ${stats.hotColdWindowGames} eligible games · 10-game window minimum`}>
    {!hasData ? <div className="px-5 py-6 sm:px-6"><p className="text-sm font-medium text-slate-700">Not enough qualifying recent appearances</p><p className="mt-1 text-xs leading-5 text-slate-400">A member needs at least 10 eligible games in the selected date window and two appearances in the latest games.</p></div> : <div className="grid gap-3 p-5 sm:grid-cols-2 sm:px-6">
      <FormCard label="Hot" tone="emerald" players={stats.hotPlayers}/><FormCard label="Cold" tone="rose" players={stats.coldPlayers}/>
    </div>}
    <p className="border-t border-slate-100 px-5 py-3 text-[10px] text-slate-400 sm:px-6">Ranked by wins / appearances; ties are shown together. This is a short descriptive window.</p>
  </Panel>;
}

function FormCard({ label, tone, players }: { label: string; tone: "emerald" | "rose"; players: DashboardStats["hotPlayers"] }) {
  return <div className={`rounded-xl border p-3 ${tone === "emerald" ? "border-emerald-100 bg-emerald-50/60" : "border-rose-100 bg-rose-50/50"}`}>
    <p className={`text-[9px] font-semibold uppercase tracking-[.16em] ${tone === "emerald" ? "text-emerald-700" : "text-rose-700"}`}>{label}</p>
    {players.map((player) => <div key={player.id} className="mt-2 flex items-center justify-between gap-2 text-[11px]"><Link href={`/players/${player.id}`} className="truncate font-medium text-slate-700 hover:text-indigo-700">{player.name}</Link><span className="shrink-0 tabular-nums text-slate-500">{player.wins}/{player.games} · {displayPercent(player.winRate)}</span></div>)}
  </div>;
}

export function CumulativeTrendPanel({ stats }: { stats: DashboardStats }) {
  const points = stats.cumulative;
  if (points.length === 0) return <Panel title="Cumulative activity" subtitle="Eligible four-player games and distinct member-owned decks"><EmptyChart message="No eligible games are in this date range."/></Panel>;
  const width = 640;
  const height = 220;
  const padX = 38;
  const padY = 18;
  const max = Math.max(1, ...points.map((point) => Math.max(point.games, point.uniqueDecks)));
  const x = (index: number) => points.length <= 1 ? width / 2 : padX + (index / (points.length - 1)) * (width - 2 * padX);
  const y = (value: number) => height - padY - (value / max) * (height - 2 * padY);
  const gamePoints = points.map((point, index) => `${x(index)},${y(point.games)}`).join(" ");
  const deckPoints = points.map((point, index) => `${x(index)},${y(point.uniqueDecks)}`).join(" ");
  const labelIndices = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])];
  return <Panel title="Cumulative eligible activity" subtitle="Running total inside the selected date window">
    <div className="px-4 pb-4 pt-5 sm:px-6">
      <div className="mb-3 flex flex-wrap gap-x-5 gap-y-2 text-[10px] text-slate-500"><span className="flex items-center gap-2"><i className="h-0.5 w-4 rounded bg-indigo-600"/> Eligible games · {stats.gamesPlayed}</span><span className="flex items-center gap-2"><i className="h-0.5 w-4 rounded bg-teal-500"/> Unique member decks · {stats.uniqueDecksPlayed}</span></div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-48 w-full overflow-visible sm:h-56" role="img" aria-label="Cumulative count of eligible four-player games and distinct member-owned decks">
        {[0, 0.5, 1].map((step) => <g key={step}><line x1={padX} x2={width - padX} y1={padY + step * (height - 2 * padY)} y2={padY + step * (height - 2 * padY)} stroke="#e8edf3" strokeWidth="1"/><text x={padX - 8} y={padY + step * (height - 2 * padY) + 3} textAnchor="end" fill="#94a3b8" fontSize="9">{Math.round(max * (1 - step))}</text></g>)}
        {points.length > 1 ? <><polyline points={gamePoints} fill="none" stroke="#5965ce" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/><polyline points={deckPoints} fill="none" stroke="#12a594" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></> : <><circle cx={x(0)} cy={y(points[0].games)} r="4" fill="#5965ce"/><circle cx={x(0)} cy={y(points[0].uniqueDecks)} r="4" fill="#12a594"/></>}
        {points.map((point, index) => <g key={point.date} className="group"><circle cx={x(index)} cy={y(point.games)} r="3.5" fill="#5965ce" stroke="white" strokeWidth="2"><title>{`${point.date}: ${point.games} eligible games, ${point.uniqueDecks} unique member decks; ${point.gamesOnDate} game(s) that day`}</title></circle><circle cx={x(index)} cy={y(point.uniqueDecks)} r="3.5" fill="#12a594" stroke="white" strokeWidth="2"><title>{`${point.date}: ${point.uniqueDecks} unique member decks`}</title></circle></g>)}
        {labelIndices.map((index) => <text key={points[index].date} x={x(index)} y={height - 1} textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"} fill="#94a3b8" fontSize="9">{formatShortDate(points[index].date)}</text>)}
      </svg>
      <p className="mt-2 text-[10px] text-slate-400">Counts include only four-player games with 2+ members and one recorded winner.</p>
    </div>
  </Panel>;
}

export function RecentGamesPanel({ stats }: { stats: DashboardStats }) {
  return <Panel title="Latest eligible games" subtitle="Most recent completed games in the selected date window" action={<Link href="/games" className="text-[10px] font-medium text-indigo-600 hover:text-indigo-800">All games →</Link>}>
    {stats.recentGames.length === 0 ? <EmptyChart message="No eligible four-player games are in this date range."/> : <ol className="divide-y divide-slate-100">
      {stats.recentGames.map((game, index) => <li key={game.id} className="flex items-start gap-3 px-5 py-4 sm:px-6">
        <span className={`grid size-8 shrink-0 place-items-center rounded-xl text-[10px] font-semibold ${index === 0 ? "bg-indigo-50 text-indigo-600" : "bg-slate-100 text-slate-500"}`}>G{game.gameNumberOnDate}</span>
        <div className="min-w-0 flex-1"><Link href={`/games?game=${encodeURIComponent(game.id)}#game-${game.id}`} className="block truncate text-xs font-semibold text-slate-700 hover:text-indigo-700">{game.winnerName} won with {game.winnerCommander}</Link><p className="mt-1 truncate text-[10px] text-slate-400">{formatLongDate(game.playedOn)} · {game.participantCount}-player pod · {game.memberNames.join(", ")}{game.guestSeats.length ? ` · ${game.guestSeats.length} guest${game.guestSeats.length === 1 ? "" : "s"}` : ""}</p></div>
        <span className="shrink-0 text-[9px] text-slate-400">{game.winnerName.startsWith("Guest") ? "Guest win" : "Winner"}</span>
      </li>)}
    </ol>}
  </Panel>;
}

function EmptyChart({ message }: { message: string }) {
  return <div className="flex min-h-36 items-center justify-center px-6 py-8 text-center"><p className="max-w-sm text-xs leading-5 text-slate-400">{message}</p></div>;
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", year: "2-digit" }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatLongDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T00:00:00.000Z`));
}
