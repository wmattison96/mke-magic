import { Panel, StatCard } from "@/components/ui";
import type { ColorAnalysis, ExpectedPerformanceRow, SeatPositionStat } from "@/lib/stats/analytics";

const colorNames = { W: "White", U: "Blue", B: "Black", R: "Red", G: "Green", C: "Colorless" } as const;
const colorStyles = {
  W: "bg-amber-100 text-amber-900 border-amber-300",
  U: "bg-blue-100 text-blue-900 border-blue-300",
  B: "bg-slate-800 text-white border-slate-600",
  R: "bg-rose-100 text-rose-900 border-rose-300",
  G: "bg-emerald-100 text-emerald-900 border-emerald-300",
  C: "bg-slate-100 text-slate-600 border-slate-300",
} as const;
const formatRate = (value: number | null) => value === null ? "N/A" : `${(value * 100).toFixed(1)}%`;

export function AnalyticsSummary({
  recordedGames,
  eligibleGames,
  memberCount,
  averagePodSize,
  rangeLabel,
}: {
  recordedGames: number;
  eligibleGames: number;
  memberCount: number;
  averagePodSize: number | null;
  rangeLabel: string;
}) {
  return <section aria-label="Analytics summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
    <StatCard label="Recorded games" value={String(recordedGames)} note={`${rangeLabel} · includes statistical exceptions`} icon="◷" accent="indigo"/>
    <StatCard label="Win-eligible games" value={String(eligibleGames)} note="2+ members and one recorded winner" icon="♜" accent="teal"/>
    <StatCard label="Members in sample" value={String(memberCount)} note="At least one recorded appearance" icon="♙" accent="amber"/>
    <StatCard label="Average pod size" value={averagePodSize === null ? "N/A" : averagePodSize.toFixed(1)} note="Across recorded games in this sample" icon="▦" accent="rose"/>
  </section>;
}

export function SeatAnalysisPanel({ rows }: { rows: SeatPositionStat[] }) {
  return <Panel title="Seat win rates" subtitle="Observed share of eligible wins by seat, beside the expected share from each seat's actual pod sizes.">
    {!rows.length ? <p className="px-5 py-8 text-xs text-slate-400 sm:px-6">No eligible games are available for seat analysis.</p> : <div className="divide-y divide-slate-100">
      {rows.map((row) => <div key={row.seat} className="grid grid-cols-[54px_minmax(80px,1fr)_88px] items-center gap-3 px-5 py-3.5 sm:grid-cols-[72px_minmax(120px,1fr)_120px] sm:gap-5 sm:px-6">
        <div><p className="text-xs font-semibold text-slate-700">Seat {row.seat}</p><p className="text-[9px] text-slate-400">{row.appearances} games</p></div>
        <div className="relative h-3 rounded-full bg-slate-100" title={`${row.wins} wins in ${row.appearances} appearances`}>
          <span className="absolute inset-y-[-3px] z-10 w-px bg-slate-500" style={{ left: `${Math.min(100, (row.expectedWinRate ?? 0) * 100)}%` }}/>
          <span className="block h-3 rounded-full bg-indigo-500" style={{ width: `${Math.min(100, (row.winRate ?? 0) * 100)}%` }}/>
        </div>
        <div className="text-right"><p className="text-xs font-semibold tabular-nums text-slate-700">{formatRate(row.winRate)}</p><p className="text-[9px] text-slate-400">expected {formatRate(row.expectedWinRate)}</p></div>
      </div>)}
      <p className="px-5 py-3 text-[9px] leading-4 text-slate-400 sm:px-6">The vertical marker uses each seat&apos;s average expected share (Σ 1 ÷ pod size ÷ seat appearances). Guest winning games remain in the seat denominator and count as a seat win.</p>
    </div>}
  </Panel>;
}

export function CoreFourPanel({ rows, eligibleGames, enabled }: { rows: ExpectedPerformanceRow[]; eligibleGames: number; enabled: boolean }) {
  return <Panel title="Core Four baseline" subtitle="Nelson, Will, Manfred, and Josh only; games count only when all four are present with no guest or substitute.">
    {!enabled ? <p className="px-5 py-8 text-xs leading-5 text-slate-400 sm:px-6">Choose 4-player pods to inspect the Core Four baseline.</p> : !eligibleGames ? <p className="px-5 py-8 text-xs leading-5 text-slate-400 sm:px-6">No eligible Core Four games occur in this date window.</p> : <>
      <div className="flex items-baseline justify-between border-b border-slate-100 px-5 py-4 sm:px-6"><span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Eligible Core Four games</span><span className="text-2xl font-semibold tabular-nums text-slate-800">{eligibleGames}</span></div>
      <ul className="divide-y divide-slate-100">{rows.map((row) => <li key={row.id} className="flex items-center justify-between gap-3 px-5 py-3 sm:px-6"><span className="text-xs font-medium text-slate-700">{row.name}</span><span className="text-right text-[10px] tabular-nums text-slate-500">{row.wins}/{row.games} · {formatRate(row.winRate)} <span className="ml-1 font-semibold text-slate-700">{row.winSurplus === null ? "" : `${row.winSurplus >= 0 ? "+" : ""}${row.winSurplus.toFixed(2)} surplus`}</span></span></li>)}</ul>
      <p className="px-5 py-3 text-[9px] leading-4 text-slate-400 sm:px-6">Expected wins use the four-player baseline (0.25 per appearance). Core Four Only removes every other game from the active analysis.</p>
    </>}
  </Panel>;
}

export function ColorMetagamePanel({ analysis }: { analysis: ColorAnalysis }) {
  const identityTotal = analysis.identityDistribution.reduce((sum, row) => sum + row.appearances, 0);
  return <div className="space-y-5">
    <Panel title="Color identity metagame" subtitle="Verified commander color identities from the public commander registry. Unknown identities are excluded, never treated as colorless.">
      {!analysis.totalDeckAppearances ? <p className="px-5 py-8 text-xs text-slate-400 sm:px-6">No member-owned deck appearances fall inside the selected population.</p> : <div className="grid gap-5 p-5 lg:grid-cols-[1fr_1fr] sm:p-6">
        <div>
          <div className="mb-3 flex items-baseline justify-between"><h3 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Color use</h3><span className="text-[9px] text-slate-400">{analysis.knownAppearances}/{analysis.totalDeckAppearances} known appearances</span></div>
          <div className="space-y-3">{analysis.colorUsage.map((row) => <div key={row.color} className="grid grid-cols-[34px_1fr_65px] items-center gap-2">
            <span className={`grid size-7 place-items-center rounded-lg border text-[10px] font-semibold ${colorStyles[row.color]}`} title={colorNames[row.color]}>{row.color}</span>
            <div className="h-2 rounded-full bg-slate-100"><span className="block h-2 rounded-full bg-indigo-500" style={{ width: `${Math.min(100, row.shareOfKnownAppearances * 100)}%` }}/></div>
            <span className="text-right text-[9px] tabular-nums text-slate-500">{row.appearances} · {formatRate(row.shareOfKnownAppearances)}</span>
          </div>)}</div>
          <p className="mt-3 text-[9px] leading-4 text-slate-400">Multicolor decks count once for each color in their identity, so these shares can add up to more than 100%.</p>
        </div>
        <div>
          <div className="mb-3 flex items-baseline justify-between"><h3 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Identity distribution</h3><span className="text-[9px] text-slate-400">{identityTotal} known deck appearances</span></div>
          <div className="grid grid-cols-3 gap-2">{analysis.identityDistribution.map((row) => <div key={row.bucket} className="rounded-xl bg-slate-50 p-3"><p className="truncate text-[9px] text-slate-500">{row.bucket}</p><p className="mt-1 text-lg font-semibold tabular-nums text-slate-800">{row.appearances}</p><p className="text-[9px] tabular-nums text-slate-400">{formatRate(row.share)}</p></div>)}</div>
        </div>
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-baseline justify-between"><h3 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Win rate by color present</h3><span className="text-[9px] text-slate-400">Colorless and overlapping identities included</span></div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{analysis.colorPerformance.map((row) => <div key={row.color} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 px-3 py-2.5" title={`${colorNames[row.color]}: ${row.wins} deck-seat wins in ${row.appearances} eligible appearances`}><span className="flex min-w-0 items-center gap-2"><span className={`grid size-6 shrink-0 place-items-center rounded-md border text-[9px] font-semibold ${colorStyles[row.color]}`}>{row.color}</span><span className="truncate text-[9px] text-slate-600">{colorNames[row.color]}</span></span><span className="shrink-0 text-right text-[10px] font-semibold tabular-nums text-slate-700">{formatRate(row.winRate)}<span className="block text-[8px] font-normal text-slate-400">n={row.appearances}</span></span></div>)}</div>
        </div>
      </div>}
      <div className="border-t border-slate-100 px-5 py-3 text-[9px] leading-4 text-slate-400 sm:px-6">Metadata coverage: {analysis.knownDecks}/{analysis.totalDecks} decks · {analysis.knownAppearances}/{analysis.totalDeckAppearances} appearances. Unknown commander/partner identities are not included as Colorless.</div>
    </Panel>
    <Panel title="Player color preferences" subtitle="Member-owned decks piloted in eligible games, grouped by verified color identity. Counts are appearances and distinct decks.">
      {!analysis.playerPreferences.length ? <p className="px-5 py-8 text-xs text-slate-400 sm:px-6">No member color preferences are available in this selection.</p> : <div className="overflow-x-auto">
        <table className="w-full min-w-[590px] text-left" aria-label="Player color preferences">
          <thead className="border-b border-slate-100 bg-slate-50/70"><tr><th className="px-5 py-3 text-[9px] font-semibold uppercase tracking-wide text-slate-400">Player</th>{(["W", "U", "B", "R", "G", "C"] as const).map((color) => <th key={color} className="px-2 py-3 text-center text-[9px] font-semibold text-slate-500" title={colorNames[color]}>{color}</th>)}<th className="px-4 py-3 text-right text-[9px] font-semibold uppercase tracking-wide text-slate-400">Colors used</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{analysis.playerPreferences.map((player) => <tr key={player.playerId}>
            <th className="px-5 py-3 text-xs font-medium text-slate-700">{player.playerName}<span className="mt-0.5 block text-[9px] font-normal text-slate-400">{player.knownAppearances} known · {player.unknownAppearances} unknown · {player.knownDecks} decks</span></th>
            {player.colorUses.map((use) => <td key={use.color} className="px-2 py-3 text-center text-[9px] tabular-nums text-slate-600" title={`${colorNames[use.color]}: ${use.appearances} appearances across ${use.uniqueDecks} decks`}>{use.appearances ? <><span className="font-semibold">{use.appearances}</span><span className="block text-[8px] text-slate-400">{use.uniqueDecks} d</span></> : <span className="text-slate-300">—</span>}</td>)}
            <td className="px-4 py-3 text-right text-[10px] font-medium text-slate-600">{player.distinctColorsUsed}</td>
          </tr>)}</tbody>
        </table>
      </div>}
    </Panel>
  </div>;
}
