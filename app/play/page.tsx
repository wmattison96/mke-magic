import { AppShell } from "@/components/app-shell";

export default function PlayPage() {
  return <AppShell activePath="/play">
    <section className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[.18em] text-indigo-600">COMING LATER</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Play</h1>
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-4 grid size-11 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M8 7h8a4 4 0 0 1 3.8 5.2l-1 3.2a2 2 0 0 1-3.3.9L13.5 13h-3l-2 3.3a2 2 0 0 1-3.3-.9l-1-3.2A4 4 0 0 1 8 7Z"/><path d="M8 9v4M6 11h4M16 10h.01M18 12h.01"/></svg>
        </div>
        <h2 className="text-sm font-semibold text-slate-900">Live game tracking is planned for a later milestone.</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">This space is a placeholder for a future play session flow. It does not start a game or save any data yet.</p>
      </div>
    </section>
  </AppShell>;
}
