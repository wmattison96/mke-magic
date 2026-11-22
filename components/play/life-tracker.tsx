"use client";

import { useState } from "react";
import { commanderDamageKey, type PlaySession, type PlaySeat } from "@/lib/play/state";

function displayName(seat: PlaySeat) {
  return seat.participantType === "guest" ? `Guest · Seat ${seat.seat}` : seat.playerName ?? "Member";
}

function ArtBackground({ seat, artByName }: { seat: PlaySeat; artByName: Record<string, string | null> }) {
  const arts = seat.commanders.map((commander) => artByName[commander.name] ?? null);
  return <>
    {arts.length > 1 ? <div className="absolute inset-0 grid grid-cols-2">
      {arts.slice(0, 2).map((url, index) => <div key={seat.commanders[index].id} className="bg-cover bg-center" style={url ? { backgroundImage: `url("${url}")` } : undefined}/>) }
    </div> : <div className="absolute inset-0 bg-cover bg-center" style={arts[0] ? { backgroundImage: `url("${arts[0]}")` } : undefined}/>}
    <div className="absolute inset-0 bg-gradient-to-br from-slate-950/85 via-slate-950/65 to-indigo-950/80" aria-hidden="true"/>
  </>;
}

function SeatQuadrant({
  seat,
  session,
  artByName,
  onAdjustLife,
  onOpenDamage,
}: {
  seat: PlaySeat;
  session: PlaySession;
  artByName: Record<string, string | null>;
  onAdjustLife: (seatId: string, delta: -1 | 1) => void;
  onOpenDamage: (seatId: string) => void;
}) {
  const life = session.lifeTotals[seat.id];
  const commanderLine = seat.commanders.map((commander) => commander.name).join(" + ");
  return <section aria-label={`Seat ${seat.seat}, ${displayName(seat)}`} className="relative isolate flex min-h-0 select-none flex-col overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-slate-900 to-indigo-950 text-white shadow-lg [touch-action:manipulation]">
    <ArtBackground seat={seat} artByName={artByName}/>
    <div className="relative flex min-h-0 flex-1 flex-col p-2.5 sm:p-4">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[9px] font-semibold uppercase tracking-[.16em] text-indigo-100/75">Seat {seat.seat}{seat.seat === 1 ? " · Starts first" : ""}</p>
          <h2 className="mt-1 truncate text-sm font-semibold text-white sm:text-base">{displayName(seat)}</h2>
          <p className="mt-0.5 line-clamp-2 text-[10px] leading-4 text-white/75 sm:text-xs">{commanderLine}</p>
        </div>
        <button type="button" onClick={() => onOpenDamage(seat.id)} className="grid min-h-10 shrink-0 place-items-center rounded-lg border border-white/20 bg-black/25 px-2 text-[9px] font-semibold text-white backdrop-blur-sm transition hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300 sm:min-h-11 sm:px-3 sm:text-[10px]" aria-label={`Open commander damage for ${displayName(seat)}`}>
          <span>Commander</span><span>damage</span>
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center py-1">
        <p aria-live="polite" aria-label={`${life} life`} className="tabular-nums text-5xl font-semibold leading-none tracking-tight text-white drop-shadow-[0_3px_14px_rgba(0,0,0,.55)] sm:text-6xl">{life}</p>
      </div>
      <div className="mx-auto flex w-full max-w-[240px] items-center justify-center gap-3">
        <button type="button" onClick={() => onAdjustLife(seat.id, -1)} aria-label={`Reduce ${displayName(seat)} life by one`} className="grid size-12 shrink-0 place-items-center rounded-full border border-white/25 bg-black/30 text-3xl font-light leading-none text-white backdrop-blur-sm transition hover:bg-white/15 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300 sm:size-14">−</button>
        <span className="min-w-12 text-center text-[9px] font-semibold uppercase tracking-[.16em] text-white/65">Life</span>
        <button type="button" onClick={() => onAdjustLife(seat.id, 1)} aria-label={`Increase ${displayName(seat)} life by one`} className="grid size-12 shrink-0 place-items-center rounded-full border border-white/25 bg-black/30 text-3xl font-light leading-none text-white backdrop-blur-sm transition hover:bg-white/15 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300 sm:size-14">+</button>
      </div>
    </div>
  </section>;
}

function CommanderDamageDialog({
  session,
  targetSeatId,
  onClose,
  onAdjust,
}: {
  session: PlaySession;
  targetSeatId: string;
  onClose: () => void;
  onAdjust: (targetSeatId: string, sourceCommanderId: string, delta: -1 | 1) => void;
}) {
  const target = session.seats.find((seat) => seat.id === targetSeatId);
  if (!target) return null;
  const sources = session.seats.filter((seat) => seat.id !== target.id).flatMap((seat) => seat.commanders.map((commander) => ({ seat, commander })));
  return <div role="presentation" className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-5" onClick={onClose}>
    <section role="dialog" aria-modal="true" aria-labelledby="commander-damage-title" className="max-h-[88svh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-white/10 bg-[#111827] p-4 text-white shadow-2xl sm:rounded-2xl sm:p-6" onClick={(event) => event.stopPropagation()}>
      <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-indigo-300">Seat {target.seat} · {displayName(target)}</p><h2 id="commander-damage-title" className="mt-1 text-lg font-semibold">Commander damage</h2></div><button type="button" onClick={onClose} aria-label="Close commander damage" className="grid size-9 shrink-0 place-items-center rounded-lg border border-white/15 text-lg text-white/80 hover:bg-white/10">×</button></div>
      <p className="mt-3 rounded-lg border border-indigo-300/15 bg-indigo-300/10 px-3 py-2.5 text-xs leading-5 text-indigo-100">Each adjustment also changes this player’s life total by the same amount in the opposite direction.</p>
      <div className="mt-4 space-y-2">
        {sources.map(({ seat, commander }) => {
          const key = commanderDamageKey(target.id, commander.id);
          const damage = session.commanderDamage[key] ?? 0;
          const lethalThreshold = damage >= 21;
          return <div key={commander.id} className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border p-3 ${lethalThreshold ? "border-rose-400/50 bg-rose-950/40" : "border-white/10 bg-white/[.04]"}`}>
            <div className="min-w-0"><p className="truncate text-[10px] font-medium text-white/60">From {displayName(seat)} · Seat {seat.seat}</p><p className="mt-0.5 truncate text-xs font-semibold text-white">{commander.name}</p><p className={`mt-1 text-[10px] ${lethalThreshold ? "font-semibold text-rose-200" : "text-white/50"}`}>{lethalThreshold ? "21+ commander damage · threshold reached" : "Separate commander damage"}</p></div>
            <div className="flex items-center gap-1.5"><button type="button" onClick={() => onAdjust(target.id, commander.id, -1)} disabled={damage === 0} aria-label={`Reduce damage from ${commander.name}`} className="grid size-10 place-items-center rounded-lg border border-white/15 text-lg text-white disabled:cursor-not-allowed disabled:opacity-35">−</button><span aria-live="polite" className={`w-9 text-center text-lg font-semibold tabular-nums ${lethalThreshold ? "text-rose-200" : "text-white"}`}>{damage}</span><button type="button" onClick={() => onAdjust(target.id, commander.id, 1)} aria-label={`Increase damage from ${commander.name}`} className="grid size-10 place-items-center rounded-lg border border-white/15 text-lg text-white">+</button></div>
          </div>;
        })}
      </div>
      <p className="mt-4 text-[10px] leading-4 text-white/45">Damage remains tracked per opposing commander. Reaching 21 does not eliminate a player or end the game.</p>
      <button type="button" onClick={onClose} className="mt-4 w-full rounded-lg bg-white/10 px-4 py-3 text-xs font-semibold text-white hover:bg-white/15">Done</button>
    </section>
  </div>;
}

function EndGameDialog({
  session,
  pending,
  error,
  onClose,
  onSave,
}: {
  session: PlaySession;
  pending: boolean;
  error: string;
  onClose: () => void;
  onSave: (notes: string, winningSeat: number) => void;
}) {
  const [notes, setNotes] = useState(session.notes);
  const [winningSeat, setWinningSeat] = useState<number | null>(session.winningSeat);
  return <div role="presentation" className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-5" onClick={() => { if (!pending) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="end-game-title" className="max-h-[92svh] w-full max-w-xl overflow-y-auto rounded-t-2xl border border-white/10 bg-white p-4 text-slate-900 shadow-2xl sm:rounded-2xl sm:p-6" onClick={(event) => event.stopPropagation()}>
      <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-indigo-600">Complete this game</p><h2 id="end-game-title" className="mt-1 text-lg font-semibold">Choose the winner</h2><p className="mt-1 text-xs text-slate-500">Review the four seats and save this result to Games.</p></div><button type="button" onClick={onClose} disabled={pending} aria-label="Close end game" className="grid size-9 shrink-0 place-items-center rounded-lg border border-slate-200 text-lg text-slate-500 disabled:opacity-50">×</button></div>
      <fieldset className="mt-5" disabled={session.submissionLocked}><legend className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Winning seat</legend><div className="grid grid-cols-2 gap-2">{session.seats.map((seat) => <label key={seat.id} className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-medium ${winningSeat === seat.seat ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-white text-slate-600"}`}><input type="radio" name="play-winner" checked={winningSeat === seat.seat} onChange={() => setWinningSeat(seat.seat)} className="accent-emerald-600"/><span className="min-w-0"><span className="block text-[9px] uppercase tracking-wide opacity-60">Seat {seat.seat}{seat.seat === 1 ? " · starts first" : ""}</span><span className="block truncate">{displayName(seat)}</span></span></label>)}</div></fieldset>
      <label className="mt-4 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Notes · optional<textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={5000} rows={3} disabled={session.submissionLocked} placeholder="Add an optional note about the game" className="mt-1.5 w-full resize-y rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-normal normal-case tracking-normal text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100 disabled:text-slate-500"/><span className="mt-1 block text-[9px] font-normal normal-case tracking-normal text-slate-400">{session.submissionLocked ? "A submission attempt has started. Retries keep the same winner, notes, and idempotency key." : "These notes are visible in the public game history. Do not include private guest names."}</span></label>
      <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Game review · {session.playedOn}</p><ol className="mt-2 grid gap-1.5 sm:grid-cols-2">{session.seats.map((seat) => <li key={seat.id} className="min-w-0 text-[10px] text-slate-600"><span className="font-semibold text-slate-800">{seat.seat}. {displayName(seat)}</span><span className="block truncate text-slate-500">{seat.commanders.map((commander) => commander.name).join(" + ")}</span></li>)}</ol><p className="mt-2 text-[9px] text-slate-400">Seat order determines who starts. Life totals and commander damage are not written to game history.</p></div>
      {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2.5 text-xs leading-5 text-rose-700">{error}</p>}
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between"><button type="button" onClick={onClose} disabled={pending} className="rounded-lg border border-slate-200 px-4 py-3 text-xs font-medium text-slate-600 disabled:opacity-50">Keep playing</button><button type="button" onClick={() => winningSeat && onSave(notes, winningSeat)} disabled={pending || winningSeat === null} className="rounded-lg bg-indigo-600 px-4 py-3 text-xs font-semibold text-white shadow-sm disabled:opacity-50">{pending ? "Saving game…" : session.submissionLocked ? "Retry same submission" : "Confirm and save game"}</button></div>
    </section>
  </div>;
}

export function LifeTracker({
  session,
  artByName,
  pending = false,
  saveError = "",
  persistenceWarning = "",
  onAdjustLife,
  onAdjustDamage,
  onDiscard,
  onSaveGame,
}: {
  session: PlaySession;
  artByName: Record<string, string | null>;
  pending?: boolean;
  saveError?: string;
  persistenceWarning?: string;
  onAdjustLife: (seatId: string, delta: -1 | 1) => void;
  onAdjustDamage: (targetSeatId: string, sourceCommanderId: string, delta: -1 | 1) => void;
  onDiscard: () => void;
  onSaveGame: (notes: string, winningSeat: number) => void;
}) {
  const [damageTargetId, setDamageTargetId] = useState<string | null>(null);
  const [endGameOpen, setEndGameOpen] = useState(false);
  return <div className="flex h-[calc(100svh-128px)] min-h-[500px] flex-col bg-[#0b1120] p-2 text-white lg:h-[calc(100vh-68px)] lg:p-3">
    <div className="mb-2 flex shrink-0 items-center justify-between gap-2 px-1 sm:mb-3 sm:px-2"><div className="min-w-0"><p className="text-[9px] font-semibold uppercase tracking-[.18em] text-indigo-300">Play · Four-player Commander</p><p className="truncate text-[10px] text-white/60">Seat 1 starts first · {session.playedOn}</p></div><div className="flex shrink-0 gap-1.5"><button type="button" onClick={onDiscard} className="min-h-10 rounded-lg border border-white/20 px-2.5 text-[10px] font-semibold text-white/75 transition hover:bg-white/10 sm:px-3 sm:text-xs">Discard</button><button type="button" onClick={() => setEndGameOpen(true)} className="min-h-10 rounded-lg border border-white/20 bg-white/10 px-3 text-[10px] font-semibold text-white transition hover:bg-white/15 sm:px-4 sm:text-xs">End Game</button></div></div>
    {persistenceWarning && <p role="alert" className="mb-2 shrink-0 rounded-lg bg-amber-400/15 px-3 py-2 text-[10px] text-amber-100">{persistenceWarning}</p>}
    <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-2 sm:gap-3">{session.seats.map((seat) => <SeatQuadrant key={seat.id} seat={seat} session={session} artByName={artByName} onAdjustLife={onAdjustLife} onOpenDamage={setDamageTargetId}/>)}</div>
    {damageTargetId && <CommanderDamageDialog session={session} targetSeatId={damageTargetId} onClose={() => setDamageTargetId(null)} onAdjust={onAdjustDamage}/>}
    {endGameOpen && <EndGameDialog session={session} pending={pending} error={saveError} onClose={() => setEndGameOpen(false)} onSave={(notes, winner) => onSaveGame(notes, winner)}/>}
  </div>;
}
