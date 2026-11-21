import Link from "next/link";
import { Panel } from "@/components/ui";
import { classifyDeckQuadrant, getDeckQuadrantAxisMax, type ColorBreakdown, type ColorIdentity, type DeckQuadrantPoint, type DeckQuadrantThreshold, type ProfileTrendPoint, type SeatPerformance } from "@/lib/stats/profiles";

const colorNames: Record<ColorIdentity, string> = { W: "White", U: "Blue", B: "Black", R: "Red", G: "Green", C: "Colorless" };
const colorStyles: Record<ColorIdentity, { bar: string; chip: string }> = {
  W: { bar: "bg-amber-300", chip: "bg-amber-50 text-amber-700" },
  U: { bar: "bg-blue-500", chip: "bg-blue-50 text-blue-700" },
  B: { bar: "bg-slate-700", chip: "bg-slate-100 text-slate-700" },
  R: { bar: "bg-rose-500", chip: "bg-rose-50 text-rose-700" },
  G: { bar: "bg-emerald-600", chip: "bg-emerald-50 text-emerald-700" },
  C: { bar: "bg-slate-400", chip: "bg-slate-100 text-slate-600" },
};

function rateText(value: number | null): string { return value === null ? "N/A" : `${(value * 100).toFixed(1)}%`; }

export function ColorBreakdownPanel({ title, breakdown, basis }: { title: string; breakdown: ColorBreakdown; basis: "decks" | "appearances" }) {
  const denominator = basis === "decks" ? breakdown.totalEntities : breakdown.totalAppearances;
  const known = basis === "decks" ? breakdown.knownEntities : breakdown.knownAppearances;
  const unknown = basis === "decks" ? breakdown.unknownEntities : breakdown.unknownAppearances;
  return <Panel title={title} subtitle={`Color occurrences · ${known} of ${denominator} ${basis} resolved`}>
    {breakdown.rows.length ? <div className="space-y-3 px-5 py-5 sm:px-6">
      {breakdown.rows.map((row) => <div key={row.color} className="grid grid-cols-[68px_1fr_72px] items-center gap-3">
        <span className="flex items-center gap-2 text-[10px] text-slate-600"><span className={`grid size-6 place-items-center rounded-lg text-[9px] font-semibold ${colorStyles[row.color].chip}`}>{row.color}</span>{colorNames[row.color]}</span>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${colorStyles[row.color].bar}`} style={{ width: `${row.share * 100}%` }}/></div>
        <span className="text-right text-[10px] tabular-nums text-slate-500">{row.count} · {(row.share * 100).toFixed(1)}%</span>
      </div>)}
      {unknown > 0 && <p className="border-t border-slate-100 pt-3 text-[10px] leading-5 text-slate-400">Color identity is unknown for {unknown} {basis}; these are excluded from color shares, not treated as colorless.</p>}
      <p className="text-[9px] leading-4 text-slate-400">A multicolor commander contributes one occurrence to each color in its identity.</p>
    </div> : <div className="px-5 py-7 text-xs leading-5 text-slate-400 sm:px-6">No resolved color identities are available for this sample yet.</div>}
  </Panel>;
}

export function SeatPerformancePanel({ seats, title = "Seat-order performance" }: { seats: SeatPerformance[]; title?: string }) {
  return <Panel title={title} subtitle="Appearance share uses 2+ member games; win rate uses single-winner games">
    {seats.length ? <div className="space-y-3 px-5 py-5 sm:px-6">
      {seats.map((seat) => <div key={seat.seat} className="grid grid-cols-[48px_1fr_90px] items-center gap-3">
        <span className="text-[10px] font-medium text-slate-600">Seat {seat.seat}</span>
        <div className="space-y-1.5"><div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-teal-500" style={{ width: `${seat.appearanceShare * 100}%` }}/></div><div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${(seat.winRate ?? 0) * 100}%` }}/></div></div>
        <span className="text-right text-[9px] leading-4 tabular-nums text-slate-400">{seat.participationEligibleAppearances} apps · {rateText(seat.winRate)}<br/>{seat.wins}/{seat.winEligibleGames} wins</span>
      </div>)}
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 pt-3 text-[9px] text-slate-400"><span className="flex items-center gap-1.5"><i className="size-1.5 rounded-full bg-teal-500"/> Share of appearances</span><span className="flex items-center gap-1.5"><i className="size-1.5 rounded-full bg-indigo-500"/> Seat win rate</span></div>
    </div> : <div className="px-5 py-7 text-xs text-slate-400 sm:px-6">No seat appearances in this pod-size sample.</div>}
  </Panel>;
}

function makeLine(points: ProfileTrendPoint[], width: number, height: number, value: (point: ProfileTrendPoint) => number, min: number, max: number) {
  const pad = 18;
  const x = (index: number) => points.length < 2 ? width / 2 : pad + index / (points.length - 1) * (width - 2 * pad);
  const y = (v: number) => height - pad - ((v - min) / (max - min || 1)) * (height - 2 * pad);
  return points.map((point, index) => `${x(index)},${y(value(point))}`).join(" ");
}

export function PlayerTrendPanels({ points, expectedWinRate }: { points: ProfileTrendPoint[]; expectedWinRate: number | null }) {
  if (!points.length) return <Panel title="Performance over time" subtitle="Cumulative eligible win rate and provisional Elo"><div className="px-5 py-8 text-xs text-slate-400 sm:px-6">No single-winner eligible appearances in this pod-size sample.</div></Panel>;
  const width = 640;
  const height = 210;
  const rateLine = makeLine(points, width, height, (point) => point.winRate, 0, 1);
  const ratings = points.map((point) => point.rating);
  const ratingMin = Math.min(900, Math.floor((Math.min(...ratings) - 10) / 10) * 10);
  const ratingMax = Math.max(1100, Math.ceil((Math.max(...ratings) + 10) / 10) * 10);
  const eloLine = makeLine(points, width, height, (point) => point.rating, ratingMin, ratingMax);
  const labelPoints = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])].map((index) => points[index]);
  return <div className="grid gap-5 xl:grid-cols-2">
    <Panel title="Cumulative win rate" subtitle="Win count / single-winner eligible appearances">
      <div className="px-4 py-4 sm:px-6"><div className="mb-2 flex justify-between text-[9px] text-slate-400"><span>0%</span><span>50%</span><span>100%</span></div><svg viewBox={`0 0 ${width} ${height}`} className="h-40 w-full" role="img" aria-label="Cumulative win rate over eligible player appearances">
        {[0, .25, .5, .75, 1].map((ratio) => <g key={ratio}><line x1="18" x2={width - 18} y1={height - 18 - ratio * (height - 36)} y2={height - 18 - ratio * (height - 36)} stroke="#e8edf3"/><text x="22" y={height - 20 - ratio * (height - 36)} fill="#94a3b8" fontSize="9">{Math.round(ratio * 100)}%</text></g>)}
        {expectedWinRate !== null && <g><line x1="18" x2={width - 18} y1={height - 18 - expectedWinRate * (height - 36)} y2={height - 18 - expectedWinRate * (height - 36)} stroke="#8b92dd" strokeDasharray="4 4"/><text x={width - 20} y={height - 22 - expectedWinRate * (height - 36)} textAnchor="end" fill="#7379c7" fontSize="9">Expected {rateText(expectedWinRate)}</text><title>{`Expected win share ${(expectedWinRate * 100).toFixed(1)}%`}</title></g>}
        {points.length > 1 ? <polyline points={rateLine} fill="none" stroke="#5965ce" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/> : <circle cx="320" cy="105" r="4" fill="#5965ce"/>}
        {points.map((point, index) => <circle key={point.gameId} cx={points.length < 2 ? 320 : 18 + index / (points.length - 1) * (width - 36)} cy={height - 18 - point.winRate * (height - 36)} r="3" fill="#5965ce" stroke="white" strokeWidth="1.5"><title>{`${point.playedOn} · ${point.wins}/${point.games} · ${rateText(point.winRate)}`}</title></circle>)}
      </svg><div className="flex justify-between text-[9px] text-slate-400"><span>{labelPoints[0]?.playedOn}</span><span>{labelPoints.at(-1)?.playedOn}</span></div></div>
    </Panel>
    <Panel title="Provisional Elo trend" subtitle="Historical rating after each eligible appearance">
      <div className="px-4 py-4 sm:px-6"><div className="mb-2 flex justify-between text-[9px] text-slate-400"><span>{ratingMin}</span><span>Starting 1000</span><span>{ratingMax}</span></div><svg viewBox={`0 0 ${width} ${height}`} className="h-40 w-full" role="img" aria-label="Provisional Elo over eligible player appearances">
        <line x1="18" x2={width - 18} y1={height / 2} y2={height / 2} stroke="#e8edf3" strokeDasharray="4 4"/><polyline points={eloLine} fill="none" stroke="#0f9d91" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
        {points.map((point, index) => <circle key={point.gameId} cx={points.length < 2 ? 320 : 18 + index / (points.length - 1) * (width - 36)} cy={height - 18 - ((point.rating - ratingMin) / (ratingMax - ratingMin || 1)) * (height - 36)} r="3" fill="#0f9d91" stroke="white" strokeWidth="1.5"><title>{`${point.playedOn} · ${Math.round(point.rating)} Elo · ${point.games} appearances`}</title></circle>)}
      </svg><div className="flex justify-between text-[9px] text-slate-400"><span>{labelPoints[0]?.playedOn}</span><span>{labelPoints.at(-1)?.playedOn}</span></div></div>
    </Panel>
  </div>;
}

export function DeckTrendPanel({ points }: { points: ProfileTrendPoint[] }) {
  if (!points.length) return <Panel title="Cumulative deck history" subtitle="Eligible appearances and wins over time"><div className="px-5 py-8 text-xs text-slate-400 sm:px-6">No single-winner eligible appearances in this pod-size sample.</div></Panel>;
  const max = Math.max(1, ...points.map((point) => point.games));
  const width = 640;
  const height = 215;
  const pad = 24;
  const x = (index: number) => points.length < 2 ? width / 2 : pad + index / (points.length - 1) * (width - 2 * pad);
  const y = (count: number) => height - pad - count / max * (height - pad * 2);
  const appearances = points.map((point, index) => `${x(index)},${y(point.games)}`).join(" ");
  const wins = points.map((point, index) => `${x(index)},${y(point.wins)}`).join(" ");
  return <Panel title="Cumulative deck history" subtitle="Single-winner eligible appearances and victories">
    <div className="px-4 py-4 sm:px-6"><div className="mb-2 flex gap-4 text-[9px] text-slate-500"><span className="flex items-center gap-1.5"><i className="h-0.5 w-4 bg-indigo-500"/> Appearances</span><span className="flex items-center gap-1.5"><i className="h-0.5 w-4 bg-teal-500"/> Wins</span></div><svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full" role="img" aria-label="Cumulative deck appearances and wins over time">
      {[0, .5, 1].map((ratio) => <g key={ratio}><line x1={pad} x2={width - pad} y1={y(max * ratio)} y2={y(max * ratio)} stroke="#e8edf3"/><text x={pad - 5} y={y(max * ratio) + 3} textAnchor="end" fill="#94a3b8" fontSize="9">{Math.round(max * ratio)}</text></g>)}
      {points.length > 1 ? <><polyline points={appearances} fill="none" stroke="#5965ce" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/><polyline points={wins} fill="none" stroke="#0f9d91" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></> : <><circle cx={x(0)} cy={y(points[0].games)} r="4" fill="#5965ce"/><circle cx={x(0)} cy={y(points[0].wins)} r="4" fill="#0f9d91"/></>}
      {points.map((point, index) => <g key={point.gameId}><circle cx={x(index)} cy={y(point.games)} r="3" fill="#5965ce"><title>{`${point.playedOn} · ${point.games} appearances · ${point.wins} wins`}</title></circle><circle cx={x(index)} cy={y(point.wins)} r="3" fill="#0f9d91"><title>{`${point.playedOn} · ${point.wins} wins`}</title></circle></g>)}
      <text x={pad} y={height - 2} fill="#94a3b8" fontSize="9">{points[0].playedOn}</text><text x={width - pad} y={height - 2} textAnchor="end" fill="#94a3b8" fontSize="9">{points.at(-1)?.playedOn}</text>
    </svg></div>
  </Panel>;
}

export function DeckQuadrantPanel({ points, selectedDeckId, threshold, expectedWinRate }: { points: DeckQuadrantPoint[]; selectedDeckId: string; threshold: DeckQuadrantThreshold; expectedWinRate: number | null }) {
  if (!points.length) return <Panel title="Relative deck performance" subtitle="Member-owned decks in this pod-size dataset"><div className="px-5 py-7 text-xs text-slate-400 sm:px-6">No eligible deck appearances are available for this dataset.</div></Panel>;
  const width = 720;
  const height = 340;
  const left = 48;
  const right = 16;
  const top = 18;
  const bottom = 46;
  const axisMax = getDeckQuadrantAxisMax(points, threshold.games);
  const rawTickStep = axisMax / 5;
  const stepMagnitude = 10 ** Math.floor(Math.log10(rawTickStep));
  const normalizedTickStep = rawTickStep / stepMagnitude;
  const tickStep = (normalizedTickStep <= 1 ? 1 : normalizedTickStep <= 2 ? 2 : normalizedTickStep <= 5 ? 5 : 10) * stepMagnitude;
  const xTicks = Array.from({ length: Math.round(axisMax / tickStep) + 1 }, (_, index) => index * tickStep);
  const x = (games: number) => left + games / axisMax * (width - left - right);
  const y = (rate: number) => height - bottom - rate * (height - top - bottom);
  const thresholdX = x(threshold.games);
  const baselineY = y(expectedWinRate ?? .25);
  const expectedText = rateText(expectedWinRate);
  const thresholdDescription = threshold.basis === "fixed-four-player"
    ? `4-player threshold: ${threshold.games} eligible games`
    : `Selected-pod median: ${threshold.medianGames} games · frequent use starts at ${threshold.games}`;
  const categoryNames = {
    promising: "Promising",
    "proven-performer": "Proven performer",
    "underperforming-unproven": "Underperforming / unproven",
    "frequent-underperformer": "Frequent underperformer",
  } as const;
  const quadrantGuide = [
    { title: "Promising", detail: `Under ${threshold.games} games · above ${expectedText}`, position: "Top left" },
    { title: "Proven performers", detail: `${threshold.games}+ games · above ${expectedText}`, position: "Top right" },
    { title: "Underperforming / unproven", detail: `Under ${threshold.games} games · at or below ${expectedText}`, position: "Bottom left" },
    { title: "Frequent underperformers", detail: `${threshold.games}+ games · at or below ${expectedText}`, position: "Bottom right" },
  ];
  return <Panel title="Relative deck performance" subtitle="Each point is a distinct owner + commander deck; low samples remain visible with N">
    <div className="px-3 pb-3 pt-4 sm:px-5">
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-500"><span>Expected win share: {expectedText}</span><span>{thresholdDescription}</span><span>Linear X-axis: 0–{axisMax} games</span></div>
      <div aria-label="Quadrant guide, arranged by chart position" className="mb-3 grid grid-cols-2 gap-2">
        {quadrantGuide.map((quadrant) => <div key={quadrant.title} className="min-w-0 rounded-lg bg-slate-50 px-2.5 py-2">
          <p className="text-[10px] font-medium text-slate-600">{quadrant.title}<span className="ml-1 font-normal text-slate-400">· {quadrant.position}</span></p>
          <p className="mt-0.5 text-[9px] leading-4 text-slate-400">{quadrant.detail}</p>
        </div>)}
      </div>
      <div className="overflow-x-auto"><svg viewBox={`0 0 ${width} ${height}`} className="min-w-[520px] w-full" role="img" aria-label={`Linear scatter plot from zero to ${axisMax} eligible games and zero to one hundred percent win rate`}>
        {[0, .25, .5, .75, 1].map((rate) => <g key={rate}><line x1={left} x2={width - right} y1={y(rate)} y2={y(rate)} stroke="#e8edf3"/><text x={left - 6} y={y(rate) + 3} textAnchor="end" fill="#94a3b8" fontSize="9">{Math.round(rate * 100)}%</text></g>)}
        {xTicks.map((tick) => <g key={tick}><line x1={x(tick)} x2={x(tick)} y1={top} y2={height - bottom} stroke="#f1f4f8"/><text x={x(tick)} y={height - bottom + 14} textAnchor={tick === 0 ? "start" : tick === axisMax ? "end" : "middle"} fill="#94a3b8" fontSize="9">{tick}</text></g>)}
        <line x1={thresholdX} x2={thresholdX} y1={top} y2={height - bottom} stroke="#64748b" strokeDasharray="4 4"><title>{`Frequent-use threshold: ${threshold.games} eligible games`}</title></line>
        <line x1={left} x2={width - right} y1={baselineY} y2={baselineY} stroke="#0f9d91" strokeDasharray="4 4"><title>{`Selected-pod expected win share: ${expectedText}`}</title></line>
        {points.map((point) => {
          const category = expectedWinRate === null ? undefined : categoryNames[classifyDeckQuadrant(point, threshold.games, expectedWinRate)];
          return <Link key={point.deckId} href={`/decks/${point.deckId}`} aria-label={`${point.ownerName}, ${point.name}, ${point.wins} wins in ${point.games} games, ${rateText(point.winRate)}${category ? `, ${category}` : ""}`}>
            <circle cx={x(point.games)} cy={y(point.winRate)} r={point.deckId === selectedDeckId ? 7 : 4.5} fill={point.deckId === selectedDeckId ? "#e28b35" : "#5965ce"} fillOpacity={point.games < 5 ? .55 : .88} stroke="white" strokeWidth="2"><title>{`${point.ownerName} · ${point.name} · ${point.wins}/${point.games} · ${rateText(point.winRate)}${category ? ` · ${category}` : ""}${point.games < 5 ? " · small sample" : ""}`}</title></circle>
          </Link>;
        })}
        <text x={width / 2} y={height - 5} textAnchor="middle" fill="#64748b" fontSize="10">Eligible single-winner games per deck</text><text x={left} y={top + 8} fill="#64748b" fontSize="9">Win rate</text>
      </svg></div><p className="mt-2 text-[10px] leading-4 text-slate-400">The vertical guide marks the use threshold; the horizontal guide is the selected pod group&apos;s expected share. X positions are linear and use actual game counts. Dots under five games are faded; select a point to open its profile.</p>
    </div>
  </Panel>;
}

export function CompactDeckLinks({ rows }: { rows: Array<{ deckId: string; ownerName: string; name: string; games: number; winsAgainst: number; lossesTo: number; winRate: number; elo: number | null }> }) {
  if (!rows.length) return <p className="px-5 py-6 text-xs text-slate-400 sm:px-6">No member-owned opponent decks to compare in this sample.</p>;
  return <ul className="divide-y divide-slate-100">{rows.map((row) => <li key={row.deckId}><Link href={`/decks/${row.deckId}`} className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-slate-50 sm:px-6"><span className="min-w-0"><span className="block truncate text-xs font-medium text-slate-700">{row.name}</span><span className="mt-1 block truncate text-[9px] text-slate-400">{row.ownerName} · {row.winsAgainst} wins in {row.games} shared pods</span></span><span className="shrink-0 text-right text-[9px] tabular-nums text-slate-500">{rateText(row.winRate)}<br/>{row.elo === null ? "Elo N/A" : `${row.elo} Elo`}</span></Link></li>)}</ul>;
}
