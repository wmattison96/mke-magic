const navigationItems = [
  { label: "Dashboard", href: "#dashboard", active: true },
  { label: "Players", href: "#players" },
  { label: "Decks", href: "#decks" },
  { label: "Games", href: "#games" },
  { label: "Tracking", href: "#tracking" },
  { label: "Analytics", href: "#analytics" },
];

export function SiteHeader() {
  return (
    <header className="border-b border-white/8 bg-slate-950/75">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
        <a href="#dashboard" className="flex items-center gap-3" aria-label="MKE Magic home">
          <span className="grid size-10 place-items-center rounded-xl border border-emerald-300/20 bg-emerald-300/10 text-lg font-semibold text-emerald-200">
            M
          </span>
          <span>
            <span className="block text-sm font-semibold tracking-wide text-slate-100">MKE MAGIC</span>
            <span className="block text-[10px] font-medium tracking-[0.22em] text-slate-500">PLAYGROUP TRACKER</span>
          </span>
        </a>
        <span className="hidden rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-400 sm:inline-flex">
          YOUR PRIVATE PLAYGROUP
        </span>
      </div>

      <nav aria-label="Main navigation" className="overflow-x-auto border-t border-white/5">
        <div className="mx-auto flex max-w-7xl min-w-max gap-1 px-4 py-2 sm:px-7">
          {navigationItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                item.active
                  ? "bg-white/8 font-medium text-white"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
              }`}
            >
              {item.label}
            </a>
          ))}
        </div>
      </nav>
    </header>
  );
}
