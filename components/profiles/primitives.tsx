import Image from "next/image";
import Link from "next/link";
import { Badge, Panel } from "@/components/ui";
import type { PodFilter, RecentProfileGame } from "@/lib/stats/profiles";

export function formatRate(value: number | null): string {
  return value === null ? "N/A" : `${(value * 100).toFixed(1)}%`;
}

export function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0] ?? "").join("").toUpperCase();
}

export function PlayerPortrait({ name, artwork, size = "md" }: { name: string; artwork?: string | null; size?: "sm" | "md" | "lg" }) {
  const dimensions = { sm: "size-10 text-xs", md: "size-12 text-sm", lg: "size-16 text-base" };
  return <span className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full border border-indigo-100 bg-indigo-50 font-semibold text-indigo-700 ${dimensions[size]}`} aria-label={`${name} avatar`}>
    {artwork ? <Image src={artwork} alt={`${name}'s most-played commander`} fill sizes="64px" unoptimized className="object-cover"/> : initials(name)}
  </span>;
}

export function CommanderArt({ name, artwork, className = "" }: { name: string; artwork?: string | null; className?: string }) {
  return <div className={`relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-100 via-slate-50 to-indigo-100 ${className}`}>
    {artwork ? <Image src={artwork} alt={`${name} card artwork`} fill sizes="(max-width: 640px) 40vw, 240px" unoptimized loading="eager" className="object-contain"/> : <div className="grid h-full place-items-center px-3 text-center"><div><span className="mx-auto grid size-10 place-items-center rounded-xl bg-white/80 text-lg text-indigo-600 shadow-sm">✦</span><p className="mt-2 text-[10px] font-medium text-slate-500">Artwork not available</p></div></div>}
  </div>;
}

export function PodFilter({ value, basePath, className = "" }: { value: PodFilter; basePath: string; className?: string }) {
  const options: Array<{ value: PodFilter; label: string }> = [
    { value: "3", label: "3 players" },
    { value: "4", label: "4 players" },
    { value: "5plus", label: "5+ players" },
  ];
  return <nav aria-label="Pod size" className={`inline-flex max-w-full rounded-xl border border-slate-200 bg-white p-1 shadow-sm ${className}`}>
    {options.map((option) => <Link key={option.value} href={`${basePath}?pods=${option.value}`} aria-current={value === option.value ? "page" : undefined} className={`rounded-lg px-3 py-2 text-[10px] font-medium transition-colors sm:text-[11px] ${value === option.value ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}>{option.label}</Link>)}
  </nav>;
}

export function ScopeNote({ value, participationGames, winGames, recordedGames }: { value: PodFilter; participationGames: number; winGames: number; recordedGames: number }) {
  const label = value === "3" ? "3-player" : value === "4" ? "4-player" : "5+ player";
  return <p className="text-[10px] leading-5 text-slate-400">{label} sample: {recordedGames} recorded games · {participationGames} with 2+ members · {winGames} single-winner games used for wins, win rate, and provisional Elo.</p>;
}

export function ProfileGameList({ games }: { games: RecentProfileGame[] }) {
  if (!games.length) return <div className="px-5 py-7 text-sm text-slate-400 sm:px-6">No recorded games in this pod-size dataset yet.</div>;
  return <ol className="divide-y divide-slate-100">
    {games.map(({ game, outcome }) => {
      const winner = game.participants.find((participant) => participant.seat === game.winningSeat);
      const winnerName = winner?.playerId ? winner.playerName : winner ? `Guest (Seat ${winner.seat})` : game.result.replaceAll("_", " ");
      const participants = game.participants.map((participant) => participant.playerId ? participant.playerName : `Guest · Seat ${participant.seat}`).join(" · ");
      return <li key={game.id}>
        <Link href={`/games?game=${encodeURIComponent(game.id)}#game-${game.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50 sm:px-6">
          <span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium text-slate-800">{game.playedOn} · Game {game.gameNumberOnDate}</span><span className="mt-1 block truncate text-[10px] text-slate-400">{participants}</span><span className="mt-1 block truncate text-[10px] text-slate-500">Winner: {winnerName}</span></span>
          <span className="flex shrink-0 items-center gap-2"><span className="text-[10px] text-slate-400">{game.podSize}-player pod</span><Badge tone={outcome === "Won" ? "green" : outcome === "Lost" ? "slate" : "amber"}>{outcome}</Badge></span>
        </Link>
      </li>;
    })}
  </ol>;
}

export function EmptyPanel({ title, message }: { title: string; message: string }) {
  return <Panel title={title}><div className="px-5 py-7 sm:px-6"><p className="text-sm font-medium text-slate-700">{message}</p></div></Panel>;
}

export function MiniStat({ label, value, note }: { label: string; value: string; note?: string }) {
  return <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3"><p className="text-[9px] font-medium uppercase tracking-[.14em] text-slate-400">{label}</p><p className="mt-1.5 text-xl font-semibold tracking-tight text-slate-900">{value}</p>{note && <p className="mt-1 text-[9px] leading-4 text-slate-400">{note}</p>}</div>;
}
