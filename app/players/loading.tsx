export default function PlayersLoading() {
  return <div className="space-y-6" aria-label="Loading player profiles"><div className="h-24 animate-pulse rounded-2xl bg-slate-200/70"/><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-40 animate-pulse rounded-2xl bg-white"/>)}</div></div>;
}
