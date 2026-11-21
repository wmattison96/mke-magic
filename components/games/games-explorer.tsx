"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { correctCompletedGame, deleteCompletedGame } from "@/app/games/actions";
import { PageHeading, Panel } from "@/components/ui";
import type { PublicGameLogEntry } from "@/lib/data/public-game-log";

const PAGE_SIZE = 20;

function displayDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function resultLabel(result: PublicGameLogEntry["result"]) {
  if (result === "single_winner") return "Single winner";
  if (result === "winner_missing") return "Winner missing";
  return result === "shared_winner" ? "Shared winner" : "Draw";
}

function cumulativePoints(games: PublicGameLogEntry[]) {
  const counts = new Map<string, number>();
  for (const game of games) counts.set(game.playedOn, (counts.get(game.playedOn) ?? 0) + 1);
  let total = 0;
  return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => {
    total += count;
    return { date, total };
  });
}

function CumulativeHistoryChart({ games }: { games: PublicGameLogEntry[] }) {
  const points = cumulativePoints(games);
  const width = 800;
  const height = 160;
  const padding = 20;
  const max = Math.max(1, points.at(-1)?.total ?? 0);
  const linePoints = points.map((point, index) => {
    const x = padding + (points.length < 2 ? 0 : (index / (points.length - 1)) * (width - padding * 2));
    const y = height - padding - (point.total / max) * (height - padding * 2);
    return `${x},${y}`;
  }).join(" ");

  return <Panel title="A history that keeps growing" subtitle={`Cumulative count of all ${games.length} logged games, including statistically excluded and exceptional outcomes.`}>
    {points.length === 0 ? <div className="px-6 py-10 text-sm text-slate-400">No games are available to chart yet.</div> : <div className="px-4 pb-4 pt-6 sm:px-6">
      <svg className="h-36 w-full overflow-visible" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Cumulative history of ${games.length} logged games`}>
        <line x1={padding} x2={width - padding} y1={height - padding} y2={height - padding} stroke="#e2e8f0" strokeWidth="1" />
        <line x1={padding} x2={padding} y1={padding} y2={height - padding} stroke="#e2e8f0" strokeWidth="1" />
        {points.length === 1 ? <circle cx={padding} cy={height - padding - (points[0].total / max) * (height - padding * 2)} r="4" fill="#6366f1" /> : <polyline points={linePoints} fill="none" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
        {points.length > 1 && <><circle cx={padding} cy={height - padding - (points[0].total / max) * (height - padding * 2)} r="3.5" fill="#6366f1" /><circle cx={width - padding} cy={padding} r="4" fill="#6366f1" /></>}
      </svg>
      <div className="mt-2 flex justify-between text-[10px] text-slate-400"><span>{displayDate(points[0].date)}</span><span>{displayDate(points.at(-1)!.date)} · {games.length} total</span></div>
    </div>}
  </Panel>;
}

function AdminCorrection({ game }: { game: PublicGameLogEntry }) {
  const router = useRouter();
  const [saving, startSaving] = useTransition();
  const [deleting, startDeleting] = useTransition();
  const [playedOn, setPlayedOn] = useState(game.playedOn);
  const [location, setLocation] = useState(game.location ?? "");
  const [notes, setNotes] = useState(game.publicNotes ?? "");
  const [resultType, setResultType] = useState(game.result);
  const [winningSeat, setWinningSeat] = useState(game.winningSeat ?? 1);
  const [reason, setReason] = useState("");
  const [deleteReason, setDeleteReason] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const allowedResults: PublicGameLogEntry["result"][] = game.source === "spreadsheet"
    ? ["single_winner", "draw", "shared_winner", "winner_missing"]
    : ["single_winner"];

  function submitCorrection(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    startSaving(async () => {
      const result = await correctCompletedGame({
        gameId: game.id,
        playedOn,
        location,
        notes,
        resultType,
        winningSeat: resultType === "single_winner" ? winningSeat : null,
        reason,
      });
      setIsError(!result.ok);
      setMessage(result.ok ? "Correction saved and recorded in the private audit log." : result.message);
      if (result.ok) router.refresh();
    });
  }

  function submitDelete() {
    setMessage("");
    startDeleting(async () => {
      const result = await deleteCompletedGame(game.id, deleteReason);
      setIsError(!result.ok);
      setMessage(result.ok ? "Game deleted and recorded in the private audit log." : result.message);
      if (result.ok) router.refresh();
    });
  }

  const inputClass = "mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";
  return <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
    <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-amber-800">Administrator correction</p>
    <p className="mt-1 text-[11px] leading-5 text-slate-500">Changes require a reason and are stored with a private before-and-after audit record. Seat identities remain intact.</p>
    <form onSubmit={submitCorrection} className="mt-4 grid gap-3 sm:grid-cols-2">
      <label className="text-[11px] font-medium text-slate-600">Game date<input required type="date" value={playedOn} onChange={(event) => setPlayedOn(event.target.value)} className={inputClass}/></label>
      <label className="text-[11px] font-medium text-slate-600">Location<input maxLength={120} value={location} onChange={(event) => setLocation(event.target.value)} className={inputClass}/></label>
      <label className="text-[11px] font-medium text-slate-600">Result<select value={resultType} onChange={(event) => { const next = event.target.value as PublicGameLogEntry["result"]; setResultType(next); if (next === "single_winner" && !winningSeat) setWinningSeat(1); }} className={inputClass}>{allowedResults.map((result) => <option key={result} value={result}>{resultLabel(result)}</option>)}</select></label>
      {resultType === "single_winner" && <label className="text-[11px] font-medium text-slate-600">Winning seat<select value={winningSeat} onChange={(event) => setWinningSeat(Number(event.target.value))} className={inputClass}>{game.participants.map((participant) => <option key={participant.seat} value={participant.seat}>Seat {participant.seat} · {participant.publicPlayerName}</option>)}</select></label>}
      <label className="text-[11px] font-medium text-slate-600 sm:col-span-2">Public game notes<textarea maxLength={5000} rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} className={inputClass}/></label>
      <label className="text-[11px] font-medium text-slate-600 sm:col-span-2">Correction reason<input required minLength={8} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="What needed correction?" className={inputClass}/></label>
      <div className="flex items-center justify-between gap-3 sm:col-span-2">
        <button disabled={saving || deleting} className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white disabled:opacity-50">{saving ? "Saving…" : "Save correction"}</button>
        <span className="text-[10px] text-slate-400">History recalculates from the corrected record.</span>
      </div>
    </form>
    <div className="mt-5 border-t border-amber-200 pt-4">
      <p className="text-xs font-semibold text-rose-800">Delete this completed game</p>
      <p className="mt-1 text-[11px] leading-5 text-slate-500">Deleting removes the game and its seat rows from public history. The audit log retains the before state.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="text-[11px] font-medium text-slate-600">Deletion reason<input maxLength={500} value={deleteReason} onChange={(event) => setDeleteReason(event.target.value)} className={inputClass}/></label>
        <label className="flex items-center gap-2 text-[10px] text-slate-600"><input type="checkbox" checked={confirmDelete} onChange={(event) => setConfirmDelete(event.target.checked)} className="accent-rose-600"/>I understand this deletes the game</label>
      </div>
      <button type="button" disabled={!confirmDelete || deleteReason.trim().length < 8 || saving || deleting} onClick={submitDelete} className="mt-3 rounded-lg border border-rose-200 px-3.5 py-2 text-xs font-medium text-rose-700 disabled:cursor-not-allowed disabled:opacity-40">{deleting ? "Deleting…" : "Delete game"}</button>
    </div>
    {message && <p role={isError ? "alert" : "status"} className={`mt-3 text-xs ${isError ? "text-rose-700" : "text-emerald-700"}`}>{message}</p>}
  </div>;
}

export function GamesExplorer({ games, isAdmin, focusGameId = null }: { games: PublicGameLogEntry[]; isAdmin: boolean; focusGameId?: string | null }) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [playerFilter, setPlayerFilter] = useState("");
  const [winnerFilter, setWinnerFilter] = useState("");
  const [commanderFilter, setCommanderFilter] = useState("");
  const focusIndex = focusGameId ? games.findIndex((game) => game.id === focusGameId) : -1;
  const [page, setPage] = useState(() => focusIndex >= 0 ? Math.floor(focusIndex / PAGE_SIZE) + 1 : 1);
  useEffect(() => {
    if (!focusGameId) return;
    const target = document.getElementById(`game-${focusGameId}`);
    if (target instanceof HTMLDetailsElement) {
      target.open = true;
      target.scrollIntoView({ block: "center" });
    }
  }, [focusGameId, page]);
  const latest = games[0];

  const players = useMemo(() => {
    const unique = new Map<string, string>();
    for (const game of games) for (const participant of game.participants) {
      if (participant.playerId) unique.set(participant.playerId, participant.publicPlayerName);
    }
    return [...unique.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [games]);
  const winnerOptions = useMemo(() => {
    const unique = new Map<string, string>();
    for (const game of games) {
      const winner = game.participants.find((participant) => participant.isWinner);
      if (winner) unique.set(winner.playerId ?? "guest", winner.publicPlayerName);
    }
    return [...unique.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [games]);

  const filteredGames = useMemo(() => games.filter((game) => {
    if (dateFrom && game.playedOn < dateFrom) return false;
    if (dateTo && game.playedOn > dateTo) return false;
    if (playerFilter && !game.participants.some((participant) => participant.playerId === playerFilter)) return false;
    const winner = game.participants.find((participant) => participant.isWinner);
    if (winnerFilter && winner?.playerId !== (winnerFilter === "guest" ? null : winnerFilter)) return false;
    if (commanderFilter) {
      const query = commanderFilter.toLocaleLowerCase();
      if (!game.participants.some((participant) => participant.commanderName.toLocaleLowerCase().includes(query) || participant.deckName?.toLocaleLowerCase().includes(query))) return false;
    }
    return true;
  }), [games, dateFrom, dateTo, playerFilter, winnerFilter, commanderFilter]);
  const maxPages = Math.max(1, Math.ceil(filteredGames.length / PAGE_SIZE));
  const visibleGames = filteredGames.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const excludedCount = games.filter((game) => !game.analyticsEligible).length;
  const exceptionalCount = games.filter((game) => game.result !== "single_winner").length;

  function resetPage<T>(setter: (value: T) => void, value: T) {
    setter(value);
    setPage(1);
  }

  return <div className="space-y-7">
    <PageHeading eyebrow="THE RECORDED SAMPLE" title="Games" description="Every recorded pod, including games outside the statistics rules and historical exceptional outcomes." action={<Link href="/tracking" className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-medium text-white shadow-sm shadow-indigo-200 transition hover:bg-indigo-700">＋ Log a game</Link>}/>

    <section className="grid gap-4 sm:grid-cols-3" aria-label="Game history summary">
      <article className="rounded-2xl border border-slate-200/80 bg-white p-5"><p className="text-xs font-medium text-slate-500">Games recorded</p><p className="mt-3 text-[28px] font-semibold tracking-[-.04em] text-slate-900">{games.length}</p><p className="mt-1 text-[11px] text-slate-400">All sources in the database</p></article>
      <article className="rounded-2xl border border-slate-200/80 bg-white p-5"><p className="text-xs font-medium text-slate-500">Below stats threshold</p><p className="mt-3 text-[28px] font-semibold tracking-[-.04em] text-slate-900">{excludedCount}</p><p className="mt-1 text-[11px] text-slate-400">Fewer than two member seats</p></article>
      <article className="rounded-2xl border border-slate-200/80 bg-white p-5"><p className="text-xs font-medium text-slate-500">Exceptional outcomes</p><p className="mt-3 text-[28px] font-semibold tracking-[-.04em] text-slate-900">{exceptionalCount}</p><p className="mt-1 text-[11px] text-slate-400">Retained; excluded from win stats</p></article>
    </section>

    <div className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
      <CumulativeHistoryChart games={games}/>
      <Panel title="Most recent result" subtitle={latest ? `${displayDate(latest.playedOn)} · Game ${latest.gameNumberOnDate}` : "No games have been recorded"}>
        {latest ? <div className="flex min-h-[145px] flex-col justify-center p-6">
          <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-slate-400">{latest.result === "single_winner" ? "Winner" : "Recorded outcome"}</p>
          <p className="mt-2 text-xl font-semibold tracking-tight text-slate-900">{latest.result === "single_winner" ? latest.participants.find((participant) => participant.isWinner)?.publicPlayerName ?? `Seat ${latest.winningSeat}` : resultLabel(latest.result)}</p>
          <p className="mt-2 text-xs text-slate-500">{latest.participants.length}-player pod · {latest.source}{latest.location ? ` · ${latest.location}` : ""}</p>
          {latest.result !== "single_winner" && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-800">No individual win is assigned for this result.</p>}
        </div> : <div className="p-6 text-sm text-slate-400">The game log is empty. Approved members can record a completed game from Tracking.</div>}
      </Panel>
    </div>

    <Panel title="Game history" subtitle={`${filteredGames.length} ${filteredGames.length === 1 ? "game" : "games"} match · newest first`}>
      <div className="grid gap-3 border-b border-slate-100 bg-slate-50/70 p-4 sm:grid-cols-2 xl:grid-cols-5">
        <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">From<input type="date" value={dateFrom} onChange={(event) => resetPage(setDateFrom, event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-normal normal-case tracking-normal text-slate-700"/></label>
        <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Through<input type="date" value={dateTo} onChange={(event) => resetPage(setDateTo, event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-normal normal-case tracking-normal text-slate-700"/></label>
        <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Player<select value={playerFilter} onChange={(event) => resetPage(setPlayerFilter, event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-normal normal-case tracking-normal text-slate-700"><option value="">All players</option>{players.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Winner<select value={winnerFilter} onChange={(event) => resetPage(setWinnerFilter, event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-normal normal-case tracking-normal text-slate-700"><option value="">Any outcome</option>{winnerOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Commander or deck<input type="search" value={commanderFilter} onChange={(event) => resetPage(setCommanderFilter, event.target.value)} placeholder="Search names" className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-normal normal-case tracking-normal text-slate-700 placeholder:text-slate-300"/></label>
      </div>

      {visibleGames.length === 0 ? <div className="px-5 py-14 text-center sm:px-8">
        <p className="text-sm font-medium text-slate-700">{games.length === 0 ? "No games recorded yet" : "No games match these filters"}</p>
        <p className="mt-2 text-xs leading-5 text-slate-400">{games.length === 0 ? "Once a member records a game, it will appear here." : "Change or clear a filter to see more of the history."}</p>
      </div> : <div className="divide-y divide-slate-100">
        {visibleGames.map((game) => {
          const winner = game.participants.find((participant) => participant.isWinner);
          return <details id={`game-${game.id}`} key={game.id} open={game.id === focusGameId} className="group scroll-mt-6 px-4 sm:px-6">
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 py-4 outline-none marker:hidden focus-visible:ring-2 focus-visible:ring-indigo-400 sm:gap-5">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-indigo-50 text-[10px] font-semibold text-indigo-600">G{game.gameNumberOnDate}</span>
              <span className="min-w-[150px] flex-1"><span className="block text-xs font-semibold text-slate-800">{displayDate(game.playedOn)} <span className="font-normal text-slate-400">· Game {game.gameNumberOnDate}</span></span><span className="mt-1 block text-[10px] text-slate-400">{game.podSize}-player pod{game.location ? ` · ${game.location}` : ""}</span></span>
              <span className="rounded-md bg-slate-100 px-2 py-1 text-[9px] font-medium text-slate-600">{game.source}</span>
              <span className={`rounded-md px-2 py-1 text-[9px] font-medium ${game.result === "single_winner" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>{game.result === "single_winner" ? `Winner · ${winner?.publicPlayerName ?? `Seat ${game.winningSeat}`}` : resultLabel(game.result)}</span>
              <span className="hidden w-28 text-right text-[10px] text-slate-400 md:inline">{game.memberCount < 2 ? "Below stats threshold" : game.result !== "single_winner" ? "Win stats excluded" : "Eligible result"}</span>
              <span aria-hidden="true" className="ml-1 text-slate-400 transition-transform group-open:rotate-180">⌄</span>
            </summary>
            <div className="pb-5 pl-12 sm:pl-[3.75rem]">
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {game.participants.map((participant) => <div key={participant.seat} className={`rounded-xl border p-3 ${participant.isWinner ? "border-emerald-200 bg-emerald-50/60" : "border-slate-100 bg-slate-50/70"}`}>
                  <div className="flex items-start justify-between gap-2"><div><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Seat {participant.seat}</p><p className="mt-1 text-xs font-semibold text-slate-800">{participant.playerId ? <Link href={`/players/${participant.playerId}`} className="hover:text-indigo-700">{participant.publicPlayerName}</Link> : participant.publicPlayerName}{participant.isWinner ? " · Winner" : ""}</p></div>{participant.playerType === "guest" && <span className="rounded bg-slate-200/70 px-1.5 py-1 text-[9px] text-slate-500">Guest</span>}</div>
                  <p className="mt-2 text-[11px] leading-5 text-slate-600">{participant.deckId ? <Link href={`/decks/${participant.deckId}`} className="hover:text-indigo-700">{participant.commanderName}</Link> : participant.commanderName}</p>
                  {participant.playerType === "member" && participant.deckName && participant.deckName !== participant.commanderName && <p className="mt-0.5 text-[10px] text-slate-400">{participant.deckId ? <Link href={`/decks/${participant.deckId}`} className="hover:text-indigo-700">{participant.deckName}</Link> : participant.deckName}</p>}
                </div>)}
              </div>
              {game.publicNotes && <div className="mt-4 rounded-xl border border-slate-100 bg-white p-3"><p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Notes</p><p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-slate-600">{game.publicNotes}</p></div>}
              <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-400"><span>Source: {game.source}</span><span>·</span><span>Date: {game.dateOrigin.replaceAll("_", " ")}</span><span>·</span><span>{game.analyticsEligible ? "Participation eligible" : "Below the two-member statistics threshold"}</span>{game.result !== "single_winner" && <><span>·</span><span>{resultLabel(game.result)}; no win-stat winner assigned</span></>}</div>
              {isAdmin && <AdminCorrection game={game}/>}
            </div>
          </details>;
        })}
      </div>}
      {filteredGames.length > PAGE_SIZE && <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 sm:px-6"><p className="text-[10px] text-slate-400">Page {page} of {maxPages} · showing {Math.min(PAGE_SIZE, filteredGames.length - (page - 1) * PAGE_SIZE)} of {filteredGames.length}</p><div className="flex gap-2"><button onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1} className="rounded-lg border border-slate-200 px-3 py-1.5 text-[10px] font-medium text-slate-600 disabled:opacity-40">Previous</button><button onClick={() => setPage((current) => Math.min(maxPages, current + 1))} disabled={page === maxPages} className="rounded-lg border border-slate-200 px-3 py-1.5 text-[10px] font-medium text-slate-600 disabled:opacity-40">Next</button></div></div>}
    </Panel>
    <p className="text-center text-[10px] leading-5 text-slate-400">Historical totals reflect Nelson’s recorded sample and may not include every game played by the group. Guest seat names are hidden.</p>
  </div>;
}
