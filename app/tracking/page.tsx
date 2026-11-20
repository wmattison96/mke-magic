import { AppShell } from "@/components/app-shell";
import { PageHeading, Panel } from "@/components/ui";

export default function TrackingPage() {
  return <AppShell activePath="/tracking"><div className="space-y-7">
    <PageHeading eyebrow="AFTER THE GAME" title="Game tracking" description="A calm, quick way to capture what happened at the table is on the roadmap." action={<span className="rounded-lg bg-slate-200 px-3.5 py-2.5 text-xs font-medium text-slate-600">Coming soon</span>}/>
    <div className="grid gap-5 xl:grid-cols-[1fr_.72fr]">
      <Panel>
        <div className="p-5 sm:p-8"><div className="mb-6 flex size-12 items-center justify-center rounded-2xl bg-indigo-50 text-xl text-indigo-600">＋</div><h2 className="text-lg font-semibold text-slate-900">A better game log starts here</h2><p className="mt-2 max-w-lg text-sm leading-6 text-slate-500">We’re shaping a simple way to record the pod, decks, winner, and the moments you want to remember. This preview is visual only; nothing is submitted or saved.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2"><label className="text-xs font-medium text-slate-500">Game night<input disabled placeholder="Choose a date" className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-400"/></label><label className="text-xs font-medium text-slate-500">Pod format<input disabled placeholder="Commander · 4 players" className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-400"/></label><label className="text-xs font-medium text-slate-500 sm:col-span-2">Who played?<input disabled placeholder="Players and decks will be selected here" className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-400"/></label></div>
          <button disabled className="mt-5 rounded-lg bg-indigo-300 px-4 py-2.5 text-xs font-medium text-white">Save game · not available yet</button>
        </div>
      </Panel>
      <Panel title="What a game entry will capture" subtitle="A few details to make stats meaningful"><div className="divide-y divide-slate-100">{[{n:"01",t:"The pod",d:"Date, format, and who sat down."},{n:"02",t:"The decks",d:"Which commander each player brought."},{n:"03",t:"The result",d:"Winner, turn count, and game length."},{n:"04",t:"The story",d:"Optional notes for memorable plays."}].map((item) => <div key={item.n} className="flex gap-4 px-5 py-4"><span className="pt-0.5 text-[10px] font-semibold text-indigo-500">{item.n}</span><div><p className="text-xs font-semibold text-slate-800">{item.t}</p><p className="mt-1 text-[11px] leading-5 text-slate-500">{item.d}</p></div></div>)}</div></Panel>
    </div>
    <p className="text-center text-[10px] text-slate-400">This preview has no database or submission functionality</p>
  </div></AppShell>;
}
