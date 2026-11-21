export default function DecksLoading() {
  return <div className="space-y-6" aria-label="Loading member decks"><div className="h-24 animate-pulse rounded-2xl bg-slate-200/70"/><div className="grid gap-4 sm:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <div key={index} className="h-24 animate-pulse rounded-2xl bg-white"/>)}</div><div className="h-80 animate-pulse rounded-2xl bg-white"/></div>;
}
