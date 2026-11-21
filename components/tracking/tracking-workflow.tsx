"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { PageHeading, Panel } from "@/components/ui";
import { createManualGame, type GameSubmission, type SubmittedSeat } from "@/app/tracking/actions";
import type { TrackingCatalog } from "@/lib/data/tracking-catalog";
import type { MemberContext } from "@/lib/supabase/verified-user";

type CommanderChoice = { id: string | null; name: string | null };
type DraftSeat = SubmittedSeat;
type AccountState = "loading" | "signed_out" | "checking" | "approved" | "unapproved" | "error";

function localToday() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function initialSeats(count = 4): DraftSeat[] {
  return Array.from({ length: count }, (_, index) => ({
    seat: index + 1,
    participantType: "member" as const,
    playerId: null,
    deckId: null,
    commanderId: null,
    commanderName: null,
  }));
}

function dateLabel(value: string) {
  if (!value) return "Choose a date";
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

function CommanderPicker({
  commanders,
  value,
  onChange,
  label,
}: {
  commanders: TrackingCatalog["commanders"];
  value: CommanderChoice;
  onChange: (choice: CommanderChoice) => void;
  label: string;
}) {
  const [query, setQuery] = useState(value.name ?? "");
  const [lookup, setLookup] = useState<{ query: string; status: "loading" | "ready" | "unavailable"; names: string[] } | null>(null);
  const [manualFallback, setManualFallback] = useState(false);
  const onChangeRef = useRef(onChange);

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  useEffect(() => {
    const trimmed = query.trim();
    const catalogMatch = commanders.find((commander) => commander.name.toLocaleLowerCase() === trimmed.toLocaleLowerCase());
    if (trimmed.length < 2 || catalogMatch) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLookup({ query: trimmed, status: "loading", names: [] });
      try {
        const response = await fetch(`/api/commander-search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal });
        const body = await response.json() as { names?: string[] };
        if (!response.ok || !Array.isArray(body.names)) throw new Error("Search unavailable");
        const names = body.names.filter((name) => typeof name === "string").slice(0, 8);
        setLookup({ query: trimmed, status: "ready", names });
        setManualFallback(false);
        const exact = names.find((name) => name.toLocaleLowerCase() === trimmed.toLocaleLowerCase());
        if (exact) onChangeRef.current({ id: null, name: exact });
      } catch {
        if (!controller.signal.aborted) {
          setLookup({ query: trimmed, status: "unavailable", names: [] });
        }
      }
    }, 350);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query, commanders]);

  const resolved = commanders.find((commander) => commander.name.toLocaleLowerCase() === query.trim().toLocaleLowerCase());
  const selectedName = value.name && value.name.toLocaleLowerCase() === query.trim().toLocaleLowerCase() ? value.name : null;
  const currentLookup = lookup?.query === query.trim() ? lookup : null;
  const status = query.trim().length < 2 || resolved ? "idle" : currentLookup?.status ?? "loading";
  const suggestions = currentLookup?.names ?? [];
  const isResolved = Boolean(resolved || selectedName || (status === "unavailable" && manualFallback && query.trim().length >= 2));

  const choose = (name: string) => {
    setQuery(name);
    setManualFallback(false);
    const match = commanders.find((commander) => commander.name.toLocaleLowerCase() === name.toLocaleLowerCase());
    onChange(match ? { id: match.id, name: match.name } : { id: null, name });
  };

  const onInput = (next: string) => {
    setQuery(next);
    setManualFallback(false);
    const match = commanders.find((commander) => commander.name.toLocaleLowerCase() === next.trim().toLocaleLowerCase());
    onChange(match ? { id: match.id, name: match.name } : { id: null, name: null });
  };

  return <div>
    <label className="block text-[10px] font-medium text-slate-500">{label}
      <input value={query} onChange={(event) => onInput(event.target.value)} autoComplete="off" placeholder="Search the commander registry" className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-800 outline-none placeholder:text-slate-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"/>
    </label>
    {status === "loading" && <p role="status" className="mt-1.5 text-[10px] text-slate-400">Checking the canonical card name…</p>}
    {status === "ready" && suggestions.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Commander search suggestions">{suggestions.map((name) => <button type="button" key={name} onClick={() => choose(name)} className={`rounded-md border px-2 py-1 text-[10px] ${value.name === name ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-600 hover:border-indigo-200"}`}>{name}</button>)}</div>}
    {status === "ready" && suggestions.length === 0 && query.trim().length >= 2 && !resolved && <p className="mt-1.5 text-[10px] text-amber-700">No canonical card name matched. Try another spelling.</p>}
    {status === "unavailable" && <div className="mt-2 rounded-lg bg-amber-50 p-2.5"><p className="text-[10px] leading-4 text-amber-800">Card lookup is temporarily unavailable. You may confirm a plain-text name as a manual fallback.</p><label className="mt-2 flex items-center gap-2 text-[10px] font-medium text-amber-900"><input type="checkbox" checked={manualFallback} onChange={(event) => { setManualFallback(event.target.checked); onChange(event.target.checked ? { id: null, name: query.trim() || null } : { id: null, name: null }); }} className="accent-amber-700"/>Use “{query.trim() || "this name"}” as a manual fallback</label></div>}
    {query.trim().length > 0 && <p className={`mt-1.5 text-[10px] ${isResolved ? "text-emerald-700" : "text-slate-400"}`}>{isResolved ? "Canonical name ready" : status === "ready" ? "Choose a search result to continue" : "Select a known commander or wait for card lookup"}</p>}
  </div>;
}

function SeatEditor({
  seat,
  catalog,
  isWinner,
  onChange,
  onWinner,
}: {
  seat: DraftSeat;
  catalog: TrackingCatalog;
  isWinner: boolean;
  onChange: (next: DraftSeat) => void;
  onWinner: () => void;
}) {
  const memberDecks = useMemo(() => catalog.decks.filter((deck) => deck.playerId === seat.playerId), [catalog.decks, seat.playerId]);
  const selectedDeck = memberDecks.find((deck) => deck.id === seat.deckId);
  const inputClass = "mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

  function setCommander(choice: CommanderChoice) {
    onChange({ ...seat, commanderId: choice.id, commanderName: choice.name });
  }

  return <section className={`rounded-2xl border p-4 sm:p-5 ${isWinner ? "border-emerald-300 bg-emerald-50/40" : "border-slate-200 bg-white"}`}>
    <div className="mb-4 flex items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-slate-100 text-xs font-semibold text-slate-600">{seat.seat}</span><div><h3 className="text-sm font-semibold text-slate-800">Seat {seat.seat}</h3><p className="text-[10px] text-slate-400">Choose player and commander</p></div></div>
      <label className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-[10px] font-semibold ${isWinner ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"}`}><input type="radio" name="winning-seat" checked={isWinner} onChange={onWinner} className="accent-emerald-600"/>Winning seat</label>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-[10px] font-medium text-slate-500">Participant type<select value={seat.participantType} onChange={(event) => onChange({ ...seat, participantType: event.target.value as DraftSeat["participantType"], playerId: null, deckId: null, commanderId: null, commanderName: null })} className={inputClass}><option value="member">Playgroup member</option><option value="guest">Guest</option></select></label>
      {seat.participantType === "member" ? <label className="text-[10px] font-medium text-slate-500">Member<select value={seat.playerId ?? ""} onChange={(event) => onChange({ ...seat, playerId: event.target.value || null, deckId: null, commanderId: null, commanderName: null })} className={inputClass}><option value="">Choose a member</option>{catalog.players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select></label> : <div className="flex items-end"><div className="w-full rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-500">Guest seat · no account or saved deck</div></div>}
      {seat.participantType === "member" && <label className="text-[10px] font-medium text-slate-500 sm:col-span-2">Owned deck<select disabled={!seat.playerId} value={seat.deckId ?? ""} onChange={(event) => {
        const deck = memberDecks.find((item) => item.id === event.target.value);
        if (deck) onChange({ ...seat, deckId: deck.id, commanderId: deck.commanderId, commanderName: deck.commanderName });
        else onChange({ ...seat, deckId: null, commanderId: null, commanderName: null });
      }} className={inputClass}><option value="">{seat.playerId ? "Choose a deck or add a commander" : "Choose a member first"}</option>{memberDecks.map((deck) => <option key={deck.id} value={deck.id}>{deck.deckName} · {deck.commanderName}</option>)}</select></label>}
      {(seat.participantType === "guest" || (seat.participantType === "member" && !selectedDeck)) && <div className="sm:col-span-2"><CommanderPicker commanders={catalog.commanders} value={{ id: seat.commanderId, name: seat.commanderName }} onChange={setCommander} label={seat.participantType === "guest" ? "Guest commander" : "New commander · a member deck will be registered automatically"}/>{seat.participantType === "member" && seat.playerId && <p className="mt-1 text-[10px] text-slate-400">An existing member + commander deck will be reused, or a new deck identity will be created when the game is saved.</p>}</div>}
    </div>
  </section>;
}

function LoginCard({
  client,
  onAccount,
}: {
  client: ReturnType<typeof createBrowserClient> | null;
  onAccount: (state: AccountState, context?: MemberContext | null) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, startBusy] = useTransition();
  const [message, setMessage] = useState("");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client) return;
    setMessage("");
    startBusy(async () => {
      const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password });
      if (error || !data.user) {
        onAccount("signed_out");
        setMessage("Sign-in failed. Check the email and password for your Supabase Auth account.");
        return;
      }
      onAccount("checking");
      const { data: context, error: contextError } = await client.rpc("current_member_context");
      if (contextError) {
        onAccount("error");
        setMessage("You signed in, but your playgroup approval could not be checked. Try again shortly.");
        return;
      }
      const member = (context as MemberContext | null) ?? null;
      onAccount(member?.approvalStatus === "approved" ? "approved" : "unapproved", member);
      setPassword("");
    });
  }

  return <Panel title="Sign in to record a game" subtitle="Tracking is available to approved playgroup members. Public game history stays readable without an account.">
    <form onSubmit={submit} className="grid gap-4 p-5 sm:max-w-xl sm:p-6">
      <label className="text-xs font-medium text-slate-600">Email<input required type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"/></label>
      <label className="text-xs font-medium text-slate-600">Password<input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"/></label>
      <button disabled={busy || !client} className="w-fit rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-medium text-white disabled:opacity-50">{busy ? "Signing in…" : "Sign in"}</button>
      {message && <p role="alert" className="text-xs text-rose-700">{message}</p>}
      {!client && <p role="alert" className="text-xs text-rose-700">Supabase browser configuration is missing. Add the public project URL and publishable key to .env.local, then restart the server.</p>}
    </form>
  </Panel>;
}

export function TrackingWorkflow({ catalog }: { catalog: TrackingCatalog }) {
  const [accountState, setAccountState] = useState<AccountState>("loading");
  const [memberContext, setMemberContext] = useState<MemberContext | null>(null);
  const [client, setClient] = useState<ReturnType<typeof createBrowserClient> | null>(null);
  const [playedOn, setPlayedOn] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [seats, setSeats] = useState<DraftSeat[]>(initialSeats());
  const [winningSeat, setWinningSeat] = useState<number | null>(null);
  const [submissionId, setSubmissionId] = useState("");
  const [review, setReview] = useState(false);
  const [saved, setSaved] = useState<{ gameNumber: number; gameId: string } | null>(null);
  const [error, setError] = useState("");
  const [saving, startSaving] = useTransition();

  const setAccount = useCallback((state: AccountState, context: MemberContext | null = null) => {
    setAccountState(state);
    setMemberContext(context);
    if (state === "approved" && context?.playerId) {
      setSeats((current) => current.map((seat) => seat.seat === 1 && seat.participantType === "member" && !seat.playerId
        ? { ...seat, playerId: context.playerId }
        : seat));
    }
  }, []);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) {
      const timer = window.setTimeout(() => setAccountState("error"), 0);
      return () => window.clearTimeout(timer);
    }
    const supabase = createBrowserClient(url, key);

    let active = true;
    const loadContext = async () => {
      setAccountState("checking");
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (!active) return;
      if (userError) {
        setAccount((userError as { name?: string }).name === "AuthSessionMissingError" ? "signed_out" : "error");
        return;
      }
      if (!userData.user) {
        setAccount("signed_out");
        return;
      }
      const { data, error: contextError } = await supabase.rpc("current_member_context");
      if (!active) return;
      if (contextError) {
        setAccount("error");
        return;
      }
      const context = (data as MemberContext | null) ?? null;
      setAccount(context?.approvalStatus === "approved" ? "approved" : "unapproved", context);
    };
    const contextTimer = window.setTimeout(() => {
      setClient(supabase);
      setPlayedOn(localToday());
      setSubmissionId(crypto.randomUUID());
      void loadContext();
    }, 0);
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (!session?.user) {
        setAccount("signed_out");
      } else {
        // Keep the auth callback synchronous; refresh private membership context afterward.
        window.setTimeout(() => { if (active) void loadContext(); }, 0);
      }
    });

    return () => {
      active = false;
      window.clearTimeout(contextTimer);
      subscription.unsubscribe();
    };
  }, [setAccount]);

  const validationErrors = useMemo(() => {
    const problems: string[] = [];
    if (seats.length < 3 || seats.length > 6) problems.push("A game must have between 3 and 6 seats.");
    if (!playedOn) problems.push("Choose the date the game was played.");
    if (!seats.some((seat) => seat.seat === winningSeat)) problems.push("Choose one winning seat.");
    const memberIds = seats.filter((seat) => seat.participantType === "member").map((seat) => seat.playerId).filter(Boolean);
    if (new Set(memberIds).size !== memberIds.length) problems.push("A member can only appear once in a game.");
    for (const seat of seats) {
      if (seat.participantType === "member" && !seat.playerId) problems.push(`Choose the member for seat ${seat.seat}.`);
      if (seat.participantType === "guest" || !seat.deckId) {
        if (!seat.commanderId && !seat.commanderName?.trim()) problems.push(`Choose a commander for seat ${seat.seat}.`);
      }
    }
    if (location.length > 120) problems.push("Location must be 120 characters or fewer.");
    if (notes.length > 5000) problems.push("Notes must be 5,000 characters or fewer.");
    return problems;
  }, [seats, playedOn, winningSeat, location, notes]);

  const updateSeat = (updated: DraftSeat) => setSeats((current) => current.map((seat) => seat.seat === updated.seat ? updated : seat));

  function changeSeatCount(delta: number) {
    const nextCount = Math.min(6, Math.max(3, seats.length + delta));
    if (winningSeat !== null && winningSeat > nextCount) setWinningSeat(null);
    setSeats((current) => {
      const next = current.slice(0, nextCount);
      while (next.length < nextCount) next.push({ ...initialSeats(1)[0], seat: next.length + 1 });
      return next.map((seat, index) => ({ ...seat, seat: index + 1 }));
    });
  }

  function submitGame() {
    if (validationErrors.length || !submissionId) {
      setError(validationErrors[0] ?? "The submission is being prepared. Please try again in a moment.");
      return;
    }
    setError("");
    const payload: GameSubmission = {
      submissionId,
      playedOn,
      location,
      notes,
      seats,
      winningSeat: winningSeat!,
    };
    startSaving(async () => {
      const result = await createManualGame(payload);
      if (!result.ok) {
        setError(result.message);
        setReview(false);
        return;
      }
      setSaved({ gameNumber: result.gameNumberOnDate, gameId: result.gameId });
      setError("");
    });
  }

  function startAnotherGame() {
    setSaved(null);
    setSubmissionId(crypto.randomUUID());
    setSeats(initialSeats());
    setWinningSeat(null);
    setPlayedOn(localToday());
    setLocation("");
    setNotes("");
    setReview(false);
    setError("");
  }

  const fieldClass = "mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

  return <div className="space-y-7">
    <PageHeading eyebrow="AFTER THE GAME" title="Game tracking" description="Record the finished pod once, review the seats, and save it to the shared playgroup history."/>

    {accountState === "loading" || accountState === "checking" ? <Panel title="Checking account access"><div role="status" className="p-6 text-xs text-slate-500">Verifying your Supabase account and playgroup approval…</div></Panel> : null}
    {accountState === "error" && <Panel title="Authentication unavailable"><div className="p-6"><p role="alert" className="text-sm text-rose-700">The account or playgroup permissions could not be checked. Confirm Supabase is reachable, then reload this page.</p>{!client && <p className="mt-2 text-xs text-slate-500">Also verify NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.</p>}</div></Panel>}
    {accountState === "signed_out" && <LoginCard client={client} onAccount={setAccount}/>}
    {accountState === "unapproved" && <Panel title="Account needs playgroup approval"><div className="space-y-4 p-5 sm:p-6"><p className="text-sm leading-6 text-slate-600">This Auth account is signed in, but it is not mapped to an approved playgroup member. Ask the administrator to approve and map the account before recording games.</p><button onClick={() => client?.auth.signOut()} className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-600">Sign out</button></div></Panel>}

    {accountState === "approved" && <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3"><div><p className="text-xs font-semibold text-emerald-900">Signed in as {memberContext?.playerName}</p><p className="mt-0.5 text-[10px] text-emerald-800">{memberContext?.role === "admin" ? "Approved administrator" : "Approved playgroup member"} · game history remains public</p></div><button onClick={async () => { await client?.auth.signOut(); setMemberContext(null); setAccountState("signed_out"); }} className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-[10px] font-medium text-emerald-800">Sign out</button></div>

      {saved ? <Panel title="Game saved" subtitle="The complete game and its seats were committed together."><div className="space-y-4 p-5 sm:p-6"><div className="rounded-xl bg-emerald-50 p-4"><p className="text-sm font-semibold text-emerald-900">{dateLabel(playedOn)} · Game {saved.gameNumber}</p><p className="mt-1 text-xs text-emerald-800">The new result is now part of the shared Games history.</p></div><div className="flex flex-wrap gap-2"><a href={`/games?game=${encodeURIComponent(saved.gameId)}`} className="rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-medium text-white">View game history</a><button onClick={startAnotherGame} className="rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-medium text-slate-600">Record another game</button></div></div></Panel> : <div className="grid items-start gap-5 xl:grid-cols-[1fr_.68fr]">
        <Panel title={review ? "Review this game" : "Completed game"} subtitle={review ? "Confirm the date, seat order, commanders, and winner before saving." : "Enter the date, optional location and notes, then add the seats in table order."}>
          {!review ? <div className="space-y-6 p-4 sm:p-6">
            <div className="grid gap-3 sm:grid-cols-2"><label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Game date<input required type="date" max={localToday()} value={playedOn} onChange={(event) => setPlayedOn(event.target.value)} className={fieldClass}/></label><label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Location · optional<input maxLength={120} value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Where did you play?" className={fieldClass}/></label><label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:col-span-2">Game notes · optional<textarea maxLength={5000} rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="A short note about the game" className={fieldClass}/><span className="mt-1 block font-normal normal-case tracking-normal text-slate-400">Notes are visible to anyone browsing the history. Do not include private guest names.</span></label></div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-y border-slate-100 py-4"><div><p className="text-xs font-semibold text-slate-800">Seats and winner</p><p className="mt-1 text-[10px] text-slate-400">Choose 3 to 6 seats. A guest may be the winner.</p></div><div className="flex items-center gap-2"><button type="button" onClick={() => changeSeatCount(-1)} disabled={seats.length <= 3} aria-label="Remove last seat" className="grid size-8 place-items-center rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40">−</button><span className="min-w-16 text-center text-xs font-medium text-slate-700">{seats.length} seats</span><button type="button" onClick={() => changeSeatCount(1)} disabled={seats.length >= 6} aria-label="Add a seat" className="grid size-8 place-items-center rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40">＋</button></div></div>
            <div className="space-y-3">{seats.map((seat) => <SeatEditor key={seat.seat} seat={seat} catalog={catalog} isWinner={winningSeat === seat.seat} onChange={updateSeat} onWinner={() => setWinningSeat(seat.seat)}/>)}</div>
            <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between"><p className="max-w-xl text-[10px] leading-5 text-slate-400">Games with fewer than two members are still saved and shown, but do not count toward official statistics. Guest seats use only the public label “Guest.”</p><button type="button" onClick={() => { setError(""); if (validationErrors.length) setError(validationErrors[0]); else setReview(true); }} className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-medium text-white shadow-sm shadow-indigo-200">Review game</button></div>
            {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2.5 text-xs text-rose-700">{error}</p>}
          </div> : <div className="space-y-5 p-4 sm:p-6">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4"><p className="text-xs font-semibold text-slate-800">{dateLabel(playedOn)}{location ? ` · ${location}` : ""}</p><p className="mt-1 text-[10px] text-slate-400">{seats.length} players · {seats.filter((seat) => seat.participantType === "member").length} members · {seats.filter((seat) => seat.participantType === "guest").length} guests</p>{notes && <p className="mt-3 whitespace-pre-wrap text-xs leading-5 text-slate-600">{notes}</p>}</div>
            <ol className="space-y-2">{seats.map((seat) => {
              const player = catalog.players.find((item) => item.id === seat.playerId);
              const deck = catalog.decks.find((item) => item.id === seat.deckId);
              return <li key={seat.seat} className={`flex items-start gap-3 rounded-xl border p-3 ${winningSeat === seat.seat ? "border-emerald-200 bg-emerald-50/60" : "border-slate-100 bg-white"}`}><span className="grid size-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-[10px] font-semibold text-slate-600">{seat.seat}</span><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-slate-800">{seat.participantType === "guest" ? "Guest" : player?.name ?? "Member"}{winningSeat === seat.seat ? " · Winner" : ""}</p><p className="mt-1 text-[11px] text-slate-500">{seat.commanderName ?? deck?.commanderName ?? "Commander"}{deck && <span className="text-slate-400"> · {deck.deckName}</span>}</p></div></li>;
            })}</ol>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between"><button onClick={() => { setReview(false); setError(""); }} className="rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-medium text-slate-600">Back to edit</button><button onClick={submitGame} disabled={saving || !submissionId} className="rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-medium text-white disabled:opacity-50">{saving ? "Saving game…" : "Confirm and save"}</button></div>
            {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2.5 text-xs text-rose-700">{error} Your entries are still available to edit.</p>}
          </div>}
        </Panel>
        <Panel title="What gets recorded" subtitle="A clear shared record for the whole pod">
          <div className="divide-y divide-slate-100">{[{ n: "01", title: "The game", text: "Date, optional location and public notes." }, { n: "02", title: "The pod", text: "Three to six seats in their actual order." }, { n: "03", title: "Members and guests", text: "Members use their own deck identity. Guest seats keep no account or permanent deck." }, { n: "04", title: "The result", text: "Exactly one winning seat; guests can win." }].map((item) => <div key={item.n} className="flex gap-4 px-5 py-4"><span className="pt-0.5 text-[10px] font-semibold text-indigo-500">{item.n}</span><div><p className="text-xs font-semibold text-slate-800">{item.title}</p><p className="mt-1 text-[11px] leading-5 text-slate-500">{item.text}</p></div></div>)}</div>
        </Panel>
      </div>}
    </>}
  </div>;
}
