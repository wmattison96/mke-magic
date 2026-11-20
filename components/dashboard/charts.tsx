import { monthlyGames, monthlyLabels, players } from "@/data/demo-data";
import { Panel } from "@/components/ui";

export function GamesTrendChart() {
  const width = 680;
  const height = 205;
  const left = 34;
  const right = 12;
  const top = 14;
  const bottom = 27;
  const max = 40;
  const points = monthlyGames.map((value, index) => ({
    x: left + (index * (width - left - right)) / (monthlyGames.length - 1),
    y: top + ((max - value) / max) * (height - top - bottom),
    value,
  }));
  const path = points.map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`).join(" ");
  const area = `${path} L${points.at(-1)?.x},${height - bottom} L${points[0].x},${height - bottom} Z`;
  return <Panel title="Games played" subtitle="Monthly game volume · last 12 months" action={<span className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-[10px] text-slate-500">12 months⌄</span>}>
    <div className="px-3 pb-2 pt-4 sm:px-5"><div className="mb-3 flex items-baseline gap-2 px-2"><span className="text-2xl font-semibold tracking-tight text-slate-900">292</span><span className="text-xs text-slate-400">games recorded</span></div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[200px] w-full overflow-visible" role="img" aria-label="Line chart showing monthly games increasing from 14 in December to 32 in November">
        <defs><linearGradient id="games-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#6366f1" stopOpacity=".17"/><stop offset="100%" stopColor="#6366f1" stopOpacity="0"/></linearGradient></defs>
        {[0, 10, 20, 30, 40].map((tick) => { const y = top + ((max - tick) / max) * (height - top - bottom); return <g key={tick}><line x1={left} y1={y} x2={width - right} y2={y} stroke="#e8ebf2" strokeDasharray="3 5"/><text x="0" y={y + 4} fill="#9aa3b4" fontSize="10">{tick}</text></g>; })}
        <path d={area} fill="url(#games-fill)"/><path d={path} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        {points.map((point, index) => <g key={index}><circle cx={point.x} cy={point.y} r="3.5" fill="white" stroke="#6366f1" strokeWidth="2"/><text x={point.x} y={height - 5} textAnchor="middle" fill="#9aa3b4" fontSize="10">{monthlyLabels[index]}</text></g>)}
      </svg>
    </div>
  </Panel>;
}

export function WinRateChart({ compact = false }: { compact?: boolean }) {
  const data = players.slice(0, compact ? 5 : 6);
  return <div className="space-y-4 px-5 py-5 sm:px-6">{data.map((player) => <div key={player.slug} className="grid grid-cols-[minmax(88px,1fr)_2fr_40px] items-center gap-3">
    <span className="truncate text-xs font-medium text-slate-600">{player.name.split(" ")[0]}</span>
    <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${player.winRate * 2.2}%` }}/></div>
    <span className="text-right text-xs font-semibold tabular-nums text-slate-700">{player.winRate.toFixed(0)}%</span>
  </div>)}</div>;
}

export function WinRatePanel({ compact = false }: { compact?: boolean }) {
  return <Panel title="Win rate by player" subtitle="Share of games won · all time" action={<span className="text-[11px] font-medium text-indigo-600">View stats →</span>}><WinRateChart compact={compact}/></Panel>;
}

export function DeckWinBars() {
  const values = [{ name: "Muldrotha", value: 41.7 }, { name: "Niv-Mizzet", value: 38.1 }, { name: "Isshin", value: 36.8 }, { name: "Teysa", value: 27.8 }, { name: "Gishath", value: 25.0 }];
  return <div className="space-y-5 px-5 py-5 sm:px-6">{values.map((deck, index) => <div key={deck.name}><div className="mb-2 flex items-center justify-between gap-3"><span className="truncate text-xs font-medium text-slate-600">{deck.name}</span><span className="text-xs font-semibold tabular-nums text-slate-700">{deck.value}%</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${index === 0 ? "bg-indigo-500" : "bg-indigo-300"}`} style={{ width: `${deck.value * 2}%` }}/></div></div>)}</div>;
}
