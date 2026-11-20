import { AppShell } from "@/components/app-shell";
import { DeckWinBars } from "@/components/dashboard/charts";
import { DeckTable } from "@/components/dashboard/tables";
import { PageHeading, Panel, StatCard } from "@/components/ui";
import { decks } from "@/data/demo-data";

export default function DecksPage() {
  const totalGames = decks.reduce((sum, deck) => sum + deck.games, 0);
  const totalWins = decks.reduce((sum, deck) => sum + deck.wins, 0);
  return <AppShell activePath="/decks"><div className="space-y-7">
    <PageHeading eyebrow="COMMANDER ARSENAL" title="Decks" description="See which lists are thriving, and which ones are still waiting for their moment." action={<span className="rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-medium text-white shadow-sm">14 decks</span>}/>
    <section className="grid gap-4 sm:grid-cols-3"><StatCard label="Decks in rotation" value="14" note="6 currently represented" icon="▤" accent="indigo"/><StatCard label="Games played" value={String(totalGames)} note="With the top 6 decks" icon="◷" accent="teal"/><StatCard label="Decks taking wins" value={String(totalWins)} note="Recorded victories" icon="♜" accent="amber"/></section>
    <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]"><DeckTable/><Panel title="Standout win rates" subtitle="Top decks · minimum 10 games"><DeckWinBars/></Panel></div>
    <p className="text-center text-[10px] text-slate-400">Deck names and performance are fictional examples</p>
  </div></AppShell>;
}
