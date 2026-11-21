import { AppShell } from "@/components/app-shell";
import { DeckWinBars, GamesTrendChart, WinRatePanel } from "@/components/dashboard/charts";
import { InsightsPanel } from "@/components/insight-card";
import { PageHeading, Panel, StatCard } from "@/components/ui";

export default function AnalyticsPage() {
  return <AppShell activePath="/analytics"><div className="space-y-7">
    <PageHeading eyebrow="PATTERNS & TRENDS" title="Analytics" description="A deeper look at the rhythms, rivalries, and decks shaping your playgroup." action={<span className="rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-600 shadow-sm">All time⌄</span>}/>
    <section className="grid gap-4 sm:grid-cols-3"><StatCard label="Total games" value="292" change="12.8%" note="Year over year" icon="◷" accent="indigo"/><StatCard label="Average pod size" value="3.8" note="Players per game" icon="♙" accent="teal"/><StatCard label="Most played night" value="Wednesday" note="38% of recorded games" icon="▦" accent="amber"/></section>
    <GamesTrendChart/>
    <section className="grid gap-5 xl:grid-cols-2"><WinRatePanel/><Panel title="Decks with the most wins" subtitle="Win rate across the top five"><DeckWinBars/></Panel></section>
    <section className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]"><InsightsPanel/><Panel title="How evenly matched is the pod?" subtitle="Player win rates vs. the 25% four-player baseline"><div className="px-5 py-6 sm:px-6"><div className="mb-5 flex items-center justify-between text-[10px] text-slate-400"><span>LOWER</span><span>EXPECTED 25%</span><span>HIGHER</span></div><div className="space-y-4">{[{name:"Will",v:35.7},{name:"Manfred",v:33.3},{name:"Josh",v:30.6},{name:"Nelson",v:26.5},{name:"Sam",v:22.6},{name:"Keenan",v:21.4}].map((item) => <div key={item.name} className="grid grid-cols-[52px_1fr_38px] items-center gap-3"><span className="text-xs text-slate-500">{item.name}</span><div className="relative h-2 rounded-full bg-slate-100"><span className="absolute -top-1 h-4 w-px bg-slate-400" style={{left:"50%"}}/><span className="block h-full rounded-full bg-indigo-500" style={{width:`${item.v*2}%`}}/></div><span className="text-right text-xs font-medium tabular-nums text-slate-600">{item.v}%</span></div>)}</div><p className="mt-5 text-[10px] leading-5 text-slate-400">Dashed marker indicates the expected 25% win share in a four-player pod.</p></div></Panel></section>
    <p className="text-center text-[10px] text-slate-400">All charts use fictional demonstration data</p>
  </div></AppShell>;
}
