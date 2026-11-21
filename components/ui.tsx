import type { ReactNode } from "react";

export function PageHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div>{eyebrow && <p className="mb-2 text-[10px] font-semibold uppercase tracking-[.2em] text-indigo-600">{eyebrow}</p>}<h1 className="text-[27px] font-semibold tracking-[-.035em] text-slate-900 sm:text-[32px]">{title}</h1>{description && <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>}</div>
    {action && <div className="shrink-0">{action}</div>}
  </div>;
}

export function Panel({ children, className = "", title, subtitle, action }: { children: ReactNode; className?: string; title?: string; subtitle?: string; action?: ReactNode }) {
  return <section className={`min-w-0 rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_10px_rgba(15,23,42,.025)] ${className}`}>
    {(title || subtitle || action) && <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6"><div>{title && <h2 className="text-sm font-semibold text-slate-800">{title}</h2>}{subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}</div>{action}</div>}
    {children}
  </section>;
}

export function PlayerAvatar({ initials, color, size = "md" }: { initials: string; color: string; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "size-7 text-[9px]", md: "size-9 text-[11px]", lg: "size-12 text-sm" };
  return <span style={{ backgroundColor: `${color}20`, color }} className={`inline-grid shrink-0 place-items-center rounded-full font-semibold ${sizes[size]}`}>{initials}</span>;
}

export function StatCard({ label, value, change, note, icon, accent = "indigo" }: { label: string; value: string; change?: string; note: string; icon: string; accent?: "indigo" | "teal" | "amber" | "rose" }) {
  const tones = {
    indigo: "bg-indigo-50 text-indigo-600",
    teal: "bg-teal-50 text-teal-700",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700",
  };
  return <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,.025)] sm:p-5">
    <div className="flex items-start justify-between"><p className="text-xs font-medium text-slate-500">{label}</p><span className={`grid size-9 place-items-center rounded-xl text-base ${tones[accent]}`}>{icon}</span></div>
    <div className="mt-4 flex items-baseline gap-2"><p className="text-[28px] font-semibold tracking-[-.04em] text-slate-900">{value}</p>{change && <span className="text-[11px] font-medium text-emerald-700">↗ {change}</span>}</div>
    <p className="mt-1 text-[11px] text-slate-400">{note}</p>
  </article>;
}

export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "green" | "blue" | "amber" }) {
  const tones = { slate: "bg-slate-100 text-slate-600", green: "bg-emerald-50 text-emerald-700", blue: "bg-blue-50 text-blue-700", amber: "bg-amber-50 text-amber-700" };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-medium ${tones[tone]}`}>{children}</span>;
}
