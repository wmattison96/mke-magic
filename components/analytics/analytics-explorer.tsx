"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Panel } from "@/components/ui";
import type {
  AnalyticsTrendSeries,
  ExpectedPerformanceRow,
  PlayerSeatStat,
} from "@/lib/stats/analytics";
import type { PlayerSharedMatchup } from "@/lib/stats/matchups";
import type { OpponentDeckMatchupStat } from "@/lib/stats/profiles";
import { DECK_RANKING_MINIMUM_GAMES, PLAYER_COMPARISON_MINIMUM_GAMES } from "@/lib/stats/profiles";

const formatRate = (rate: number | null) => rate === null ? "N/A" : `${(rate * 100).toFixed(1)}%`;
const formatSigned = (value: number | null) => value === null ? "N/A" : `${value > 0 ? "+" : ""}${value.toFixed(2)}`;
const panelNote = "Expected wins are the sum of 1 ÷ actual pod size for each eligible appearance.";

export function ExpectedPerformanceExplorer({
  players,
  decks,
}: {
  players: ExpectedPerformanceRow[];
  decks: ExpectedPerformanceRow[];
}) {
  const [kind, setKind] = useState<"player" | "deck">("player");
  const rows = kind === "player" ? players : decks;
  const ranked = rows.filter((row) => row.qualifiesForRanking);
  const minimum = kind === "player" ? 10 : 5;

  return <Panel title="Expected wins & performance surplus" subtitle={panelNote}>
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
      <div className="inline-flex rounded-lg bg-slate-100 p-1" aria-label="Performance identity type">
        {(["player", "deck"] as const).map((value) => <button key={value} type="button" aria-pressed={kind === value} onClick={() => setKind(value)} className={`rounded-md px-3 py-1.5 text-[11px] font-medium capitalize ${kind === value ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>{value}s</button>)}
      </div>
      <p className="text-[10px] text-slate-400">Rankings require {minimum}+ eligible games · {ranked.length} currently qualify</p>
    </div>
    {rows.length ? <div className="divide-y divide-slate-100">
      {rows.map((row) => {
        const maxMagnitude = Math.max(1, ...ranked.map((item) => Math.abs(item.winSurplus ?? 0)));
        const width = Math.min(50, Math.abs(row.winSurplus ?? 0) / maxMagnitude * 50);
        return <div key={row.id} className={`grid gap-2 px-5 py-3.5 sm:grid-cols-[minmax(130px,1.2fr)_minmax(130px,1.4fr)_auto] sm:items-center sm:gap-5 sm:px-6 ${row.qualifiesForRanking ? "" : "opacity-65"}`}>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-slate-700">{row.name}</p>
            <p className="mt-0.5 truncate text-[9px] text-slate-400">{kind === "deck" ? `${row.ownerName} · ${row.commanderName}` : `${row.games} eligible appearances`}</p>
          </div>
          <div className="min-w-0">
            <div className="mb-1 flex justify-between text-[9px] text-slate-400"><span>− surplus</span><span>0 expected</span><span>+ surplus</span></div>
            <div className="relative h-2 rounded-full bg-slate-100">
              <span className="absolute inset-y-[-2px] left-1/2 w-px bg-slate-400" />
              {row.winSurplus !== null && <span className={`absolute top-0 h-2 rounded-full ${row.winSurplus >= 0 ? "bg-indigo-500" : "bg-rose-400"}`} style={row.winSurplus >= 0 ? { left: "50%", width: `${width}%` } : { right: "50%", width: `${width}%` }} />}
            </div>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-right sm:min-w-[155px] sm:flex-col sm:items-end sm:gap-0">
            <span className="text-[10px] text-slate-500">{row.wins}/{row.games} wins · {formatRate(row.winRate)}</span>
            <span className={`text-xs font-semibold tabular-nums ${row.winSurplus === null ? "text-slate-400" : row.winSurplus >= 0 ? "text-indigo-700" : "text-rose-700"}`}>{formatSigned(row.winSurplus)}<span className="ml-1 text-[9px] font-normal text-slate-400">surplus</span></span>
            <span className="text-[9px] text-slate-400">Expected {row.expectedWins.toFixed(2)} · Elo {row.elo ?? "N/A"}{!row.qualifiesForRanking && <span className="ml-1 text-amber-600">· needs {Math.max(0, minimum - row.games)} more</span>}</span>
          </div>
        </div>;
      })}
    </div> : <EmptyState>There are no eligible appearances in this selection.</EmptyState>}
  </Panel>;
}

export function PlayerMatchupExplorer({
  playerId,
  players,
  rows,
  minimumGames,
}: {
  playerId: string;
  players: Array<{ id: string; name: string }>;
  rows: PlayerSharedMatchup[];
  minimumGames: number;
}) {
  const player = players.find((item) => item.id === playerId);
  const opponents = player ? players.filter((item) => item.id !== playerId).map((opponent) => {
    const row = rows.find((item) => item.playerId === playerId && item.opponentId === opponent.id);
    return { opponent, row };
  }).filter((item) => item.row).sort((a, b) =>
    (b.row?.sharedGames ?? 0) - (a.row?.sharedGames ?? 0)
      || a.opponent.name.localeCompare(b.opponent.name)
      || a.opponent.id.localeCompare(b.opponent.id)) : [];
  return <Panel title="Player matchup matrix" subtitle={`Only players with ${PLAYER_COMPARISON_MINIMUM_GAMES}+ eligible games appear. Directional wins use multiplayer shared pods; guest or other wins remain in the denominator, not the member's wins.`}>
    {players.length < 2 ? <EmptyState>{players.length === 0
      ? `No players meet the ${PLAYER_COMPARISON_MINIMUM_GAMES}-eligible-game display minimum in this selection.`
      : `Only ${players[0].name} meets the ${PLAYER_COMPARISON_MINIMUM_GAMES}-eligible-game display minimum; at least two qualifying players are needed for a matchup matrix.`}</EmptyState> : <>
      <div className="px-5 pt-4 sm:px-6"><p className="text-[10px] leading-5 text-slate-400">Showing {players.length} qualified players. Highlighted cells require {minimumGames}+ shared eligible games. Click a game sample to open that record.</p></div>
      <div className="overflow-x-auto px-5 pb-5 pt-3 sm:px-6">
        <table className="w-full min-w-[620px] border-separate border-spacing-1 text-left" aria-label="Player matchup matrix for qualifying players">
          <thead><tr><th className="px-2 py-2 text-[9px] font-semibold uppercase tracking-wide text-slate-400">Player / opponent</th>{players.map((column) => <th key={column.id} className={`max-w-24 px-2 py-2 text-center text-[9px] font-semibold ${column.id === playerId ? "text-indigo-700" : "text-slate-500"}`}><span className="block truncate">{column.name}</span></th>)}</tr></thead>
          <tbody>{players.map((rowPlayer) => <tr key={rowPlayer.id}>
            <th className={`max-w-28 px-2 py-2 text-[10px] font-medium ${rowPlayer.id === playerId ? "text-indigo-700" : "text-slate-600"}`}><span className="block truncate">{rowPlayer.name}</span></th>
            {players.map((column) => {
              if (rowPlayer.id === column.id) return <td key={column.id} className="rounded-md bg-slate-50 text-center text-[9px] text-slate-300">—</td>;
              const item = rows.find((matchup) => matchup.playerId === rowPlayer.id && matchup.opponentId === column.id);
              const qualifies = (item?.sharedGames ?? 0) >= minimumGames;
              const isFocus = rowPlayer.id === playerId;
              return <td key={column.id} className={`rounded-md px-1 py-2 text-center ${!item ? "bg-slate-50 text-slate-300" : qualifies ? isFocus ? "bg-indigo-50 text-indigo-800" : "bg-slate-100 text-slate-600" : "bg-slate-50 text-slate-400"}`} title={item ? `${rowPlayer.name}: ${item.wins} wins in ${item.sharedGames} shared games (${formatRate(item.winRate)})${qualifies ? "" : ` · below ${minimumGames}-game highlight threshold`}` : "No eligible shared games"}>
                {item ? <><span className="block text-[10px] font-semibold tabular-nums">{formatRate(item.winRate)}</span><span className="mt-0.5 block text-[8px] tabular-nums">{item.wins}/{item.sharedGames}</span></> : <span className="text-[9px]">—</span>}
              </td>;
            })}
          </tr>)}</tbody>
        </table>
      </div>
      {player ? <div className="border-t border-slate-100 px-5 py-4 sm:px-6">
        <h3 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{player.name}’s shared pods</h3>
        {opponents.length ? <ul className="mt-2 grid gap-2 sm:grid-cols-2">{opponents.map(({ opponent, row }) => row && <li key={opponent.id} className="flex min-w-0 items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2.5"><span className="min-w-0"><span className="block truncate text-[10px] font-medium text-slate-700">{opponent.name}</span><span className="text-[9px] text-slate-400">{row.wins}/{row.sharedGames} wins/games</span></span><span className="shrink-0 text-right text-[10px] font-semibold text-slate-700">{formatRate(row.winRate)}{row.gameIds[0] && <Link href={`/games?game=${encodeURIComponent(row.gameIds[0])}`} className="ml-2 font-normal text-indigo-600 hover:text-indigo-800">View sample</Link>}</span></li>)}</ul> : <p className="mt-2 text-xs text-slate-400">No member has shared an eligible pod with this player in the selected range.</p>}
      </div> : <p role="status" className="border-t border-slate-100 px-5 py-4 text-xs leading-5 text-slate-400 sm:px-6">The selected player does not meet the {PLAYER_COMPARISON_MINIMUM_GAMES}-game display minimum. The matrix above still shows comparisons between qualifying players.</p>}
    </>}
  </Panel>;
}

export function DeckMatchupExplorer({
  selectedDeck,
  rows,
  minimumGames,
}: {
  selectedDeck: { id: string; ownerName: string; name: string; commanderName: string } | undefined;
  rows: OpponentDeckMatchupStat[];
  minimumGames: number;
}) {
  const [view, setView] = useState<"all" | "best" | "toughest">("all");
  const qualifying = rows.filter((row) => row.sharedGames >= minimumGames);
  const shown = useMemo(() => {
    const eligible = view === "all" ? rows : qualifying;
    return [...eligible].sort((a, b) => view === "best"
      ? b.winRate - a.winRate || b.sharedGames - a.sharedGames || a.ownerName.localeCompare(b.ownerName) || a.deckId.localeCompare(b.deckId)
      : view === "toughest"
        ? a.winRate - b.winRate || b.sharedGames - a.sharedGames || a.ownerName.localeCompare(b.ownerName) || a.deckId.localeCompare(b.deckId)
        : b.sharedGames - a.sharedGames || a.ownerName.localeCompare(b.ownerName) || a.name.localeCompare(b.name) || a.deckId.localeCompare(b.deckId));
  }, [rows, qualifying, view]);
  return <Panel title="Deck matchup explorer" subtitle="Selected-deck wins ÷ eligible shared pods containing both member-owned decks. These are multiplayer shared-pod statistics, not one-on-one matches.">
    {!selectedDeck ? <EmptyState>Choose a member-owned deck to explore its shared pods.</EmptyState> : <>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
        <div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-700">{selectedDeck.ownerName} · {selectedDeck.commanderName}</p><p className="mt-0.5 truncate text-[10px] text-slate-400">{selectedDeck.name}</p></div>
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1" aria-label="Deck matchup ranking">
          {(["all", "best", "toughest"] as const).map((value) => <button key={value} type="button" aria-pressed={view === value} onClick={() => setView(value)} className={`rounded-md px-2.5 py-1.5 text-[9px] font-medium capitalize ${view === value ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500"}`}>{value === "all" ? "Most faced" : value}</button>)}
        </div>
      </div>
      {!rows.length ? <EmptyState>No opposing member-owned decks share eligible games with this deck in the selected range.</EmptyState> : !qualifying.length && view !== "all" ? <EmptyState>No matchup meets the minimum {minimumGames} shared games in this selection. The underlying games remain included in the other statistics.</EmptyState> : <div className="divide-y divide-slate-100">
        {shown.slice(0, 10).map((row) => <div key={row.deckId} className="grid gap-2 px-5 py-3.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-6">
          <Link href={`/decks/${encodeURIComponent(row.deckId)}`} className="min-w-0 group"><span className="block truncate text-xs font-medium text-slate-700 group-hover:text-indigo-700">{row.commanderName}</span><span className="mt-1 block truncate text-[10px] text-slate-400">{row.ownerName} · {row.name}</span></Link>
          <div className="flex items-center justify-between gap-3 sm:block sm:text-right"><span className="text-[9px] text-slate-400">{row.sharedGames} shared · {row.wins} selected-deck wins</span><span className="ml-3 text-[11px] font-semibold tabular-nums text-slate-700">{formatRate(row.winRate)}</span></div>
          <div className="flex flex-wrap gap-1 sm:col-span-2">{row.gameIds.slice(0, 3).map((gameId, index) => <Link key={gameId} href={`/games?game=${encodeURIComponent(gameId)}`} className="rounded bg-slate-50 px-2 py-1 text-[8px] text-indigo-600 hover:bg-indigo-50">Game {index + 1}</Link>)}{row.gameIds.length > 3 && <span className="px-1 py-1 text-[8px] text-slate-400">+{row.gameIds.length - 3} more</span>}</div>
        </div>)}
      </div>}
      <p className="border-t border-slate-100 px-5 py-3 text-[9px] leading-4 text-slate-400 sm:px-6">Best and Toughest use a {minimumGames}-game minimum. Guest winners remain in the denominator without being credited as a member-deck win.</p>
    </>}
  </Panel>;
}

type TrendMetric = "cumulativeWinRate" | "rollingWinRate" | "elo" | "cumulativeWins";
const metricLabels: Record<TrendMetric, string> = { cumulativeWinRate: "Cumulative win rate", rollingWinRate: "Rolling 10 games", elo: "Provisional Elo", cumulativeWins: "Cumulative wins" };
const lineColors = ["#4f46e5", "#0d9488", "#d97706", "#e11d48", "#7c3aed", "#0891b2", "#65a30d", "#c2410c"];

function trendLabel(series: AnalyticsTrendSeries): string {
  return series.kind === "deck"
    ? `${series.commanderName ?? series.name} · ${series.ownerName ?? "Unknown owner"}`
    : series.name;
}

function toggleSelection(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((selectedId) => selectedId !== id) : [...ids, id];
}

export function TrendExplorer({
  playerSeries,
  deckSeries,
  defaultPlayerIds,
  defaultDeckIds,
  playerSelectionKey,
  selectedPlayerId,
  selectedDeckId,
}: {
  playerSeries: AnalyticsTrendSeries[];
  deckSeries: AnalyticsTrendSeries[];
  defaultPlayerIds: string[];
  defaultDeckIds: string[];
  playerSelectionKey: string;
  selectedPlayerId: string;
  selectedDeckId: string;
}) {
  const [kind, setKind] = useState<"player" | "deck">("player");
  const [metric, setMetric] = useState<TrendMetric>("cumulativeWinRate");
  const source = kind === "player" ? playerSeries : deckSeries;
  const focusId = kind === "player" ? selectedPlayerId : selectedDeckId;
  const selected = source.find((series) => series.id === focusId) ?? source[0];
  return <Panel title="Performance through time" subtitle="Choose eligible players or decks to compare. Cumulative history and Elo retain earlier games through the selected end date.">
    <div className="flex flex-wrap gap-2 px-5 py-4 sm:px-6">
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1">{(["player", "deck"] as const).map((value) => <button type="button" key={value} aria-pressed={kind === value} onClick={() => setKind(value)} className={`rounded-md px-3 py-1.5 text-[10px] font-medium capitalize ${kind === value ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500"}`}>{value}s</button>)}</div>
      <select aria-label="Trend metric" value={metric} onChange={(event) => setMetric(event.target.value as TrendMetric)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] text-slate-600">{Object.entries(metricLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      {selected && <span className="self-center text-[9px] text-slate-400">Focus: {trendLabel(selected)}</span>}
    </div>
    <TrendLinesContent
      key={`players:${playerSelectionKey}`}
      kind="player"
      hidden={kind !== "player"}
      source={playerSeries}
      defaultIds={defaultPlayerIds}
      metric={metric}
    />
    <TrendLinesContent
      key={`decks:${selectedDeckId}`}
      kind="deck"
      hidden={kind !== "deck"}
      source={deckSeries}
      defaultIds={defaultDeckIds}
      metric={metric}
    />
  </Panel>;
}

function TrendLinesContent({ kind, hidden, source, defaultIds, metric }: {
  kind: "player" | "deck";
  hidden: boolean;
  source: AnalyticsTrendSeries[];
  defaultIds: string[];
  metric: TrendMetric;
}) {
  const [selectedIds, setSelectedIds] = useState(defaultIds);
  const visible = source.filter((series) => selectedIds.includes(series.id));
  const sourceOrder = new Map(source.map((series, index) => [series.id, index]));
  const values = visible.flatMap((series) => series.points.flatMap((point) => {
    const value = point[metric];
    return typeof value === "number" ? [metric === "elo" ? value : metric.endsWith("Rate") ? value * 100 : value] : [];
  }));
  const width = 900;
  const height = 280;
  const padding = { left: 48, right: 18, top: 18, bottom: 32 };
  const minValue = metric === "elo" ? Math.floor(Math.min(900, ...values) / 50) * 50 : metric.endsWith("Rate") ? 0 : 0;
  const maxValue = metric === "elo" ? Math.ceil(Math.max(1100, ...values) / 50) * 50 : metric.endsWith("Rate") ? 100 : Math.max(1, ...values);
  const y = (raw: number) => height - padding.bottom - ((raw - minValue) / Math.max(1, maxValue - minValue)) * (height - padding.top - padding.bottom);
  const x = (index: number, length: number) => padding.left + (length < 2 ? 0 : (index / (length - 1)) * (width - padding.left - padding.right));
  const toggleSeries = (id: string) => setSelectedIds((current) => toggleSelection(current, id));
  return <div hidden={hidden}>
    {!source.length ? <EmptyState>{kind === "player"
      ? `No players meet the ${PLAYER_COMPARISON_MINIMUM_GAMES}-eligible-game trend minimum in this selection.`
      : `No decks meet the ${DECK_RANKING_MINIMUM_GAMES}-eligible-game trend minimum in this selection.`}</EmptyState> : <>
      <div className="px-5 pb-3 sm:px-6">
        <p className="mb-2 text-[9px] leading-4 text-slate-400">{kind === "player"
          ? `All ${PLAYER_COMPARISON_MINIMUM_GAMES}+ game players are selected by default.`
          : `The focused deck is selected by default; all decks with ${DECK_RANKING_MINIMUM_GAMES}+ games remain available. A focused deck below that minimum is also selectable.`} Select lines:</p>
        <div aria-label={`${kind} trend lines`} className="grid max-h-28 grid-cols-1 gap-1 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
          {source.map((series) => {
            const color = lineColors[(sourceOrder.get(series.id) ?? 0) % lineColors.length];
            return <label key={series.id} className="flex min-w-0 cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[9px] text-slate-600 hover:bg-slate-50">
              <input type="checkbox" checked={selectedIds.includes(series.id)} onChange={() => toggleSeries(series.id)} className="size-3.5 shrink-0 accent-indigo-600"/>
              <span className="size-2 shrink-0 rounded-full" style={{ background: color }}/>
              <span className="min-w-0 flex-1 truncate" title={trendLabel(series)}>{trendLabel(series)}</span>
              <span className="shrink-0 text-[8px] tabular-nums text-slate-400">{series.appearances}</span>
            </label>;
          })}
        </div>
      </div>
      {!visible.length ? <EmptyState>Select at least one {kind} to draw a trend line.</EmptyState> : !values.length ? <EmptyState>{metric === "rollingWinRate" && visible.some((series) => series.points.length)
        ? "Rolling win rate needs a complete 10-game window. The selected line(s) do not have enough eligible appearances in this date range."
        : `The selected ${kind}${visible.length === 1 ? "" : "s"} have no eligible appearances in this date range.`}</EmptyState> : <div className="px-3 pb-4 sm:px-6">
      <div className="overflow-x-auto">
        <svg className="h-56 min-w-[650px] w-full" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${metricLabels[metric]} trend for selected ${kind}`}>
          {[0, .25, .5, .75, 1].map((fraction) => { const value = minValue + (maxValue - minValue) * fraction; const gridY = y(value); return <g key={fraction}><line x1={padding.left} x2={width - padding.right} y1={gridY} y2={gridY} stroke="#e2e8f0" strokeDasharray="3 4"/><text x={padding.left - 8} y={gridY + 3} textAnchor="end" fontSize="9" fill="#94a3b8">{metric.endsWith("Rate") ? `${value.toFixed(0)}%` : value.toFixed(0)}</text></g>; })}
          {visible.map((series) => {
            const color = lineColors[(sourceOrder.get(series.id) ?? 0) % lineColors.length];
            const plotted = series.points.flatMap((point, index) => {
              const raw = point[metric];
              if (typeof raw !== "number") return [];
              const value = metric === "elo" || metric === "cumulativeWins" ? raw : raw * 100;
              return [{ point, value, x: x(index, Math.max(series.points.length, 2)), y: y(value) }];
            });
            return <g key={series.id}>
              {plotted.length > 1 && <polyline fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={plotted.map((point) => `${point.x},${point.y}`).join(" ")}/>} 
              {plotted.map(({ point, value, x: pointX, y: pointY }) => <circle key={point.gameId} cx={pointX} cy={pointY} r="3" fill={color}><title>{`${trendLabel(series)} · ${point.playedOn} · ${metricLabels[metric]}: ${metric.endsWith("Rate") ? `${value.toFixed(1)}%` : value.toFixed(0)} · ${point.appearances} appearances${point.elo === null ? "" : ` · Elo ${point.elo}`}`}</title></circle>)}
            </g>;
          })}
        </svg>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[9px]">{visible.map((series) => <span key={series.id} className="inline-flex items-center gap-1.5 text-slate-500"><span className="size-2 rounded-full" style={{ background: lineColors[(sourceOrder.get(series.id) ?? 0) % lineColors.length] }}/>{trendLabel(series)} · {series.appearances} games</span>)}</div>
      {metric === "rollingWinRate" && <p className="mt-3 text-[9px] leading-4 text-slate-400">Rolling rate appears after 10 eligible appearances and carries a rolling window across the date-filter boundary.</p>}
      <div className="mt-2 flex justify-between text-[9px] text-slate-400"><span>{visible.flatMap((series) => series.points).map((point) => point.playedOn).sort()[0]}</span><span>{visible.flatMap((series) => series.points).map((point) => point.playedOn).sort().at(-1)}</span></div>
    </div>}
    </>}
  </div>;
}

export function PlayerSeatExplorer({ rows, selectedPlayerId }: { rows: PlayerSeatStat[]; selectedPlayerId: string }) {
  const player = rows.find((row) => row.playerId === selectedPlayerId);
  return <Panel title={player ? `${player.playerName} — Seat Performance History` : "Player Seat Performance History"} subtitle={player ? `Win rates by seat for ${player.playerName}. Each sample uses eligible appearances in the active pod/date filter.` : "Choose a player with eligible appearances to inspect seat performance."}>
    {!player || !player.seats.length ? <EmptyState>{player ? `${player.playerName} has no eligible seat appearances in this selection.` : "No player is selected for seat history."}</EmptyState> : <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4 sm:p-5">
      {player.seats.map((seat) => <div key={seat.seat} className="rounded-xl bg-slate-50 p-3"><p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Seat {seat.seat}</p><p className="mt-1 text-lg font-semibold tabular-nums text-slate-800">{formatRate(seat.winRate)}</p><p className="mt-1 text-[9px] text-slate-400">{seat.wins}/{seat.appearances} wins/games</p></div>)}
    </div>}
  </Panel>;
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="px-5 py-8 text-xs leading-5 text-slate-400 sm:px-6">{children}</p>;
}
