import { Badge, Panel } from "@/components/ui";

const styles: Record<string, string> = {
  violet: "bg-violet-50 text-violet-700",
  blue: "bg-blue-50 text-blue-700",
  amber: "bg-amber-50 text-amber-700",
};

export function InsightCard({ eyebrow, title, detail, icon, tone }: { eyebrow: string; title: string; detail: string; icon: string; tone: string }) {
  return <article className="flex gap-3 border-b border-slate-100 px-5 py-4 last:border-0 sm:px-6"><span className={`grid size-9 shrink-0 place-items-center rounded-xl text-base ${styles[tone] ?? styles.violet}`}>{icon}</span><div className="min-w-0"><Badge tone="slate">{eyebrow}</Badge><h3 className="mt-2 text-xs font-semibold leading-5 text-slate-800">{title}</h3><p className="mt-1 text-[11px] leading-5 text-slate-500">{detail}</p></div></article>;
}

export function InsightsPanel({ limit = 3 }: { limit?: number }) {
  const insights = [
    { eyebrow: "MOST CONSISTENT", title: "Rowan is on a 3-game win streak", detail: "Muldrotha has taken the last three games Rowan played.", icon: "↗", tone: "violet" },
    { eyebrow: "TABLE TALK", title: "Long games favor blue decks", detail: "Games over 90 minutes have a higher Izzet win rate.", icon: "◷", tone: "blue" },
    { eyebrow: "NEW RECORD", title: "October was your biggest month", detail: "35 games played, up 21% from September.", icon: "✳", tone: "amber" },
  ];
  return <Panel title="Around the table" subtitle="Small patterns from your group"><div>{insights.slice(0, limit).map((item) => <InsightCard key={item.eyebrow} {...item}/>)}</div></Panel>;
}
