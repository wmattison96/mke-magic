"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { createManualGame } from "@/app/tracking/actions";
import { SeatEditor, type DraftSeat } from "@/components/tracking/tracking-workflow";
import { Panel, PageHeading } from "@/components/ui";
import type { TrackingCatalog } from "@/lib/data/tracking-catalog";
import { createClientId } from "@/lib/client/async";
import {
  adjustCommanderDamage,
  adjustLife,
  createPlaySession,
  getPlayDate,
  toPlayGameSubmission,
  validatePlaySetup,
  type PlaySession,
  type PlaySetupSeat,
} from "@/lib/play/state";
import type { MemberContext } from "@/lib/supabase/verified-user";
import { LifeTracker } from "./life-tracker";
import { usePlaySessionStore } from "./use-play-session";

function initialSetup(member: MemberContext): DraftSeat[] {
  return Array.from({ length: 4 }, (_, index) => ({
    seat: index + 1,
    participantType: "member" as const,
    playerId: index === 0 ? member.playerId : null,
    deckId: null,
    commanderId: null,
    commanderName: null,
  }));
}

function setupSeatData(seats: DraftSeat[], catalog: TrackingCatalog): PlaySetupSeat[] {
  return seats.map((seat) => ({
    ...seat,
    playerName: seat.participantType === "guest" ? null : catalog.players.find((player) => player.id === seat.playerId)?.name ?? null,
    deckName: seat.deckId ? catalog.decks.find((deck) => deck.id === seat.deckId)?.deckName ?? null : null,
  }));
}

function commanderNames(name: string | null) {
  return (name ?? "").split(/\s+\/\s+(?!\/)/).map((commander) => commander.trim()).filter(Boolean);
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" onClick={onClose}>
    <section role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6" onClick={(event) => event.stopPropagation()}>
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>{children}
    </section>
  </div>;
}

function DiscardPrompt({ completed = false, onClose, onConfirm }: { completed?: boolean; onClose: () => void; onConfirm: () => void }) {
  return <Modal title={completed ? "Clear this completed session?" : "Discard this unfinished game?"} onClose={onClose}>
    <p className="mt-3 text-sm leading-6 text-slate-600">{completed ? "This clears the leftover counters from this browser. The completed game remains saved in Games." : "This removes the unfinished session and its counters from this browser. No database game has been created."}</p>
    <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-medium text-slate-600">Keep game</button><button type="button" onClick={onConfirm} className="rounded-lg bg-rose-600 px-4 py-2.5 text-xs font-semibold text-white">{completed ? "Clear session" : "Discard game"}</button></div>
  </Modal>;
}

export function PlayWorkflow({ catalog, member }: { catalog: TrackingCatalog | null; member: MemberContext }) {
  const { session, invalidStoredSession, storageUnavailable, hasStoredValue, save, clear } = usePlaySessionStore();
  const [setupSeats, setSetupSeats] = useState(() => initialSetup(member));
  const [resumed, setResumed] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [storageMessage, setStorageMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [savedGame, setSavedGame] = useState<{ gameId: string; gameNumber: number; needsCleanup: boolean } | null>(null);
  const [artByName, setArtByName] = useState<Record<string, string | null>>({});
  const [saving, startSaving] = useTransition();

  const problems = useMemo(() => validatePlaySetup(setupSeats), [setupSeats]);
  const artNames = useMemo(() => {
    const activeSeats = session?.seats.map((seat) => seat.commanderName) ?? setupSeats.map((seat) => seat.commanderName);
    return [...new Set(activeSeats.flatMap(commanderNames))];
  }, [session, setupSeats]);
  const artRequestKey = artNames.join("\u001f");

  useEffect(() => {
    if (!artNames.length) return;
    const controller = new AbortController();
    void Promise.all(artNames.map(async (name) => {
      try {
        const response = await fetch(`/api/commander-art?name=${encodeURIComponent(name)}`, { signal: controller.signal });
        if (!response.ok) return [name, null] as const;
        const result = await response.json() as { artUrl?: string | null };
        return [name, typeof result.artUrl === "string" ? result.artUrl : null] as const;
      } catch {
        return [name, null] as const;
      }
    })).then((entries) => {
      if (controller.signal.aborted) return;
      setArtByName((current) => ({ ...current, ...Object.fromEntries(entries) }));
    });
    return () => controller.abort();
  // The joined string is the stable identity of the selected commander names.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artRequestKey]);

  function updateSeat(updated: DraftSeat) {
    setSetupSeats((current) => current.map((seat) => seat.seat === updated.seat ? updated : seat));
  }

  function startGame() {
    if (problems.length || storageUnavailable || !catalog) return;
    const submissionId = createClientId();
    const nextSession = createPlaySession({
      seats: setupSeatData(setupSeats, catalog),
      startedByPlayerId: member.playerId,
      startedByPlayerName: member.playerName,
      playedOn: getPlayDate(),
      submissionId,
      sessionId: createClientId(),
    });
    if (!save(nextSession)) {
      setStorageMessage("This browser could not save the game locally. Check browser storage settings and try again; the game has not started.");
      return;
    }
    setStorageMessage("");
    setSaveError("");
    setSavedGame(null);
    setResumed(true);
  }

  function discardSession() {
    if (!clear()) {
      setStorageMessage("This browser could not clear the saved session. Check browser storage settings and try again.");
      return;
    }
    setConfirmDiscard(false);
    setResumed(false);
    setSavedGame(null);
    setStorageMessage("");
    setSaveError("");
  }

  function confirmDiscardAction() {
    if (savedGame?.needsCleanup) {
      if (!clear()) {
        setStorageMessage("This browser could not clear the completed session. Check browser storage settings and try again.");
        return;
      }
      setConfirmDiscard(false);
      setSavedGame({ ...savedGame, needsCleanup: false });
      setStorageMessage("");
      return;
    }
    discardSession();
  }

  function updateActiveSession(next: PlaySession) {
    if (!save(next)) {
      setStorageMessage("The counter change was not saved. Free browser storage before continuing so this game can resume safely.");
      return;
    }
    setStorageMessage("");
  }

  function finishGame(notes: string, winningSeat: number) {
    if (!session) return;
    const updated = session.submissionLocked ? session : { ...session, notes, winningSeat, submissionLocked: true };
    if (!save(updated)) {
      setSaveError("The winner and notes could not be saved in browser storage. Your game is still active; check storage settings and retry.");
      return;
    }
    const payload = toPlayGameSubmission(updated);
    if (!payload) {
      setSaveError("Choose one winner from the four seated players.");
      return;
    }
    setSaveError("");
    startSaving(async () => {
      try {
        const result = await createManualGame(payload);
        if (!result.ok) {
          setSaveError(result.message);
          return;
        }
        const cleared = clear();
        setSavedGame({ gameId: result.gameId, gameNumber: result.gameNumberOnDate, needsCleanup: !cleared });
        setResumed(false);
        setSaveError("");
      } catch {
        setSaveError("The game could not be confirmed because the connection failed. Your session is retained; retry to safely check or complete the same submission.");
      }
    });
  }

  if (storageUnavailable) return <div className="mx-auto max-w-3xl p-4 py-12"><Panel title="Browser storage is unavailable"><p className="p-5 text-sm leading-6 text-slate-600">Play needs local browser storage to preserve counters during refreshes. Enable local storage for this site, then reload before starting.</p></Panel></div>;

  if (savedGame) return <><div className="mx-auto max-w-2xl px-4 py-10 sm:py-16"><Panel title="Game saved" subtitle="The four seats and winning result were committed in one database transaction."><div className="space-y-4 p-5 sm:p-6"><div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4"><p className="text-sm font-semibold text-emerald-900">Game {savedGame.gameNumber} is in the shared history.</p><p className="mt-1 text-xs leading-5 text-emerald-800">Life totals and commander damage stay on this device and are not added to the official record.</p>{savedGame.needsCleanup && <p className="mt-3 text-xs text-amber-800">The game saved, but this browser could not clear its local session. Use “Clear completed session” before starting another game.</p>}{storageMessage && <p role="alert" className="mt-2 text-xs text-rose-700">{storageMessage}</p>}</div><div className="flex flex-wrap gap-2"><Link href={`/games?game=${encodeURIComponent(savedGame.gameId)}`} className="rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white">View saved game</Link>{savedGame.needsCleanup && <button type="button" onClick={() => setConfirmDiscard(true)} className="rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-medium text-slate-600">Clear completed session</button>}<button type="button" disabled={savedGame.needsCleanup} onClick={() => { setSavedGame(null); setSetupSeats(initialSetup(member)); }} className="rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-medium text-slate-600 disabled:cursor-not-allowed disabled:opacity-40">Start another game</button></div></div></Panel></div>{confirmDiscard && <DiscardPrompt completed onClose={() => setConfirmDiscard(false)} onConfirm={confirmDiscardAction}/>}</>;

  if (session && session.startedByPlayerId !== member.playerId) return <><div className="mx-auto max-w-2xl px-4 py-10 sm:py-16"><Panel title="A saved game belongs to another member" subtitle="For account safety, only the member who started this local session can resume or submit it."><div className="space-y-4 p-5 sm:p-6"><p className="text-sm leading-6 text-slate-600">This browser has an unfinished game started by {session.startedByPlayerName}. You are signed in as {member.playerName}. You can discard the saved game after confirming below.</p><button type="button" onClick={() => setConfirmDiscard(true)} className="rounded-lg border border-rose-200 px-4 py-2.5 text-xs font-semibold text-rose-700">Discard saved game</button></div></Panel></div>{confirmDiscard && <DiscardPrompt onClose={() => setConfirmDiscard(false)} onConfirm={confirmDiscardAction}/>}</>;

  if (invalidStoredSession) return <><div className="mx-auto max-w-2xl px-4 py-10 sm:py-16"><Panel title="Saved game could not be restored"><div className="space-y-4 p-5 sm:p-6"><p className="text-sm leading-6 text-slate-600">The saved Play session is incomplete or from an unsupported version. It has not been removed. You can confirm to discard it and start a new game.</p><button type="button" onClick={() => setConfirmDiscard(true)} className="rounded-lg border border-rose-200 px-4 py-2.5 text-xs font-semibold text-rose-700">Discard saved session</button></div></Panel></div>{confirmDiscard && <DiscardPrompt onClose={() => setConfirmDiscard(false)} onConfirm={confirmDiscardAction}/>}</>;

  if (session && !resumed) return <><div className="mx-auto max-w-2xl px-4 py-10 sm:py-16"><Panel title="Unfinished game found" subtitle="Your counters and seat assignments are saved on this device."><div className="space-y-4 p-5 sm:p-6"><ol className="grid gap-2 sm:grid-cols-2">{session.seats.map((seat) => <li key={seat.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3"><p className="text-[9px] font-semibold uppercase tracking-wide text-indigo-600">Seat {seat.seat}{seat.seat === 1 ? " · starts first" : ""}</p><p className="mt-1 truncate text-xs font-semibold text-slate-800">{seat.participantType === "guest" ? `Guest · Seat ${seat.seat}` : seat.playerName}</p><p className="mt-0.5 truncate text-[10px] text-slate-500">{seat.commanderName}</p></li>)}</ol><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setResumed(true)} className="rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white">Resume Game</button><button type="button" onClick={() => setConfirmDiscard(true)} className="rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-medium text-slate-600">Discard unfinished game</button></div></div></Panel></div>{confirmDiscard && <DiscardPrompt onClose={() => setConfirmDiscard(false)} onConfirm={confirmDiscardAction}/>}</>;

  if (session && resumed) return <><LifeTracker
    session={session}
    artByName={artByName}
    pending={saving}
    saveError={saveError}
    persistenceWarning={storageMessage}
    onAdjustLife={(seatId, delta) => updateActiveSession(adjustLife(session, seatId, delta))}
    onAdjustDamage={(targetSeatId, sourceCommanderId, delta) => updateActiveSession(adjustCommanderDamage(session, targetSeatId, sourceCommanderId, delta))}
    onDiscard={() => setConfirmDiscard(true)}
    onSaveGame={finishGame}
  />{confirmDiscard && <DiscardPrompt onClose={() => setConfirmDiscard(false)} onConfirm={confirmDiscardAction}/>}</>;

  if (!catalog) return <section className="mx-auto max-w-2xl px-4 py-12"><div className="rounded-2xl border border-rose-100 bg-white p-6 shadow-sm"><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-rose-600">Play data unavailable</p><h1 className="mt-2 text-lg font-semibold text-slate-900">Could not load player and deck choices</h1><p role="alert" className="mt-2 text-sm leading-6 text-slate-600">No sample roster is shown. Check the Supabase connection and read access to the public player, commander, and deck projections, then reload. A saved local game can still be resumed above.</p></div></section>;

  const statusNote = hasStoredValue ? "A saved game is ready to resume or discard." : "No unfinished game is saved on this device.";
  return <div className="min-h-full bg-[#f4f6fa] px-4 py-7 sm:px-7 sm:py-9 xl:px-10">
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeading eyebrow="PLAY · LIVE COUNTERS" title="Start a Commander game" description="Choose four seats and commanders. Counters stay on this device until you confirm the winner."/>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-indigo-100 bg-indigo-50/70 px-4 py-3"><p className="text-xs font-medium text-indigo-900">Starting player: Seat 1 · 40 life each</p><p className="text-[10px] text-indigo-700">{statusNote}</p></div>
      {storageMessage && <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-800">{storageMessage}</p>}
      <div className="grid gap-3">{setupSeats.map((seat) => <SeatEditor
        key={seat.seat}
        seat={seat}
        catalog={catalog}
        showWinnerSelection={false}
        excludeMemberIds={setupSeats.filter((other) => other.seat !== seat.seat && other.participantType === "member" && other.playerId).map((other) => other.playerId!)}
        onChange={updateSeat}
      />)}</div>
      {problems.length > 0 && <ul className="list-disc space-y-1 rounded-xl border border-amber-100 bg-amber-50 px-5 py-3 pl-8 text-[11px] text-amber-800">{problems.map((problem) => <li key={problem}>{problem}</li>)}</ul>}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"><p className="max-w-2xl text-[10px] leading-5 text-slate-500">Starting creates no database record. The game is stored in this browser and submitted once after you choose a winner. Seat 1 starts first.</p><button type="button" onClick={startGame} disabled={problems.length > 0} className="shrink-0 rounded-lg bg-indigo-600 px-5 py-3 text-xs font-semibold text-white shadow-sm shadow-indigo-200 disabled:cursor-not-allowed disabled:opacity-45">Start Game · 40 life</button></div>
    </div>
    {confirmDiscard && <DiscardPrompt onClose={() => setConfirmDiscard(false)} onConfirm={confirmDiscardAction}/>}
  </div>;
}
