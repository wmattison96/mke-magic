import type { DashboardRange } from "@/lib/stats/dashboard";
import type { PodFilter } from "@/lib/stats/profiles";
import { Panel } from "@/components/ui";

export interface AnalyticsFilterOption {
  id: string;
  label: string;
  ownerName?: string;
  commanderName?: string;
  games: number;
}

const fieldClass = "mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-normal normal-case tracking-normal text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

export function AnalyticsFilterBar({
  podFilter,
  range,
  coreFourOnly,
  coreFourAvailable,
  selectedPlayerId,
  selectedDeckId,
  players,
  decks,
}: {
  podFilter: PodFilter;
  range: DashboardRange;
  coreFourOnly: boolean;
  coreFourAvailable: boolean;
  selectedPlayerId: string;
  selectedDeckId: string;
  players: AnalyticsFilterOption[];
  decks: AnalyticsFilterOption[];
}) {
  const topDeckIds = new Set([...decks].sort((a, b) =>
    b.games - a.games
      || (a.ownerName ?? "").localeCompare(b.ownerName ?? "")
      || a.label.localeCompare(b.label)
      || a.id.localeCompare(b.id)).slice(0, 10).map((deck) => deck.id));
  return <Panel title="Analysis filters" subtitle="Pod size and date range define the statistical population. Player and deck selections focus the interactive comparisons.">
    <form action="/analytics" method="get" className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-[.8fr_.9fr_1.2fr_1.5fr_1.3fr_auto] xl:items-end sm:p-5">
      <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Pod size
        <select name="pods" defaultValue={podFilter} className={fieldClass}>
          <option value="3">3 players</option><option value="4">4 players</option><option value="5plus">5+ players</option>
        </select>
      </label>
      <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Date range
        <select name="range" defaultValue={range} className={fieldClass}>
          <option value="all">All time</option><option value="365">Last 365 days</option><option value="30">Last 30 days</option>
        </select>
      </label>
      <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Focus player
        <select name="player" defaultValue={selectedPlayerId} className={fieldClass}>
          {players.map((player) => <option key={player.id} value={player.id}>{player.label} · {player.games} games</option>)}
        </select>
      </label>
      <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Deck matchup focus
        <select name="deck" defaultValue={selectedDeckId} className={fieldClass}>
          {decks.map((deck) => <option key={deck.id} value={deck.id}>{topDeckIds.has(deck.id) ? "★ Top 10 · " : ""}{deck.ownerName} · {deck.commanderName} · {deck.games} games</option>)}
        </select>
      </label>
      <label className={`flex min-h-[42px] items-center gap-2 rounded-lg border border-slate-200 px-3 text-[10px] font-medium text-slate-600 ${!coreFourAvailable ? "opacity-50" : ""}`}>
        <input type="checkbox" name="coreFour" value="1" defaultChecked={coreFourOnly} disabled={!coreFourAvailable} className="size-4 accent-indigo-600"/>
        Core Four Only · 4-player
      </label>
      <button className="rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-300">Update</button>
    </form>
  </Panel>;
}
