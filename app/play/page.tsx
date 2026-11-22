import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PlayWorkflow } from "@/components/play/play-workflow";
import { getTrackingCatalog, type TrackingCatalog } from "@/lib/data/tracking-catalog";
import { getCurrentMemberContext, type MemberContext } from "@/lib/supabase/verified-user";

export const instant = false;

export default function PlayPage() {
  return <AppShell activePath="/play"><Suspense fallback={<PlayLoading/>}><PlayLive/></Suspense></AppShell>;
}

function PlayLoading() {
  return <div className="mx-auto max-w-2xl px-4 py-12"><div role="status" aria-busy="true" className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">Verifying account access and loading Play…</div></div>;
}

async function PlayLive() {
  await connection();
  let context: MemberContext | null = null;
  let catalog: TrackingCatalog | null = null;
  let accessError = false;
  try {
    context = await getCurrentMemberContext();
  } catch {
    accessError = true;
  }
  if (!accessError && context?.approvalStatus === "approved") {
    try {
      catalog = await getTrackingCatalog();
    } catch {
      catalog = null;
    }
  }

  return <>
    {accessError ? <section className="mx-auto max-w-2xl px-4 py-12"><div className="rounded-2xl border border-rose-100 bg-white p-6 shadow-sm"><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-rose-600">Account check unavailable</p><h1 className="mt-2 text-lg font-semibold text-slate-900">Play could not verify your access</h1><p role="alert" className="mt-2 text-sm leading-6 text-slate-600">Reload when Supabase is reachable. The Play setup is hidden until the account and member approval can be verified.</p></div></section>
      : context?.approvalStatus === "approved" ? <PlayWorkflow catalog={catalog} member={context}/>
        : <section className="mx-auto max-w-2xl px-4 py-12 sm:py-16"><div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-indigo-600">Approved playgroup accounts</p><h1 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">Sign in to start a game</h1><p className="mt-2 text-sm leading-6 text-slate-600">Only an approved member or administrator can open a Play session. Sign in through the existing Tracking page, then return here.</p>{context && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-800">This account is {context.approvalStatus}. Ask the administrator to approve and map it to a playgroup member before using Play.</p>}<Link href="/tracking" className="mt-5 inline-flex rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white">Go to Tracking sign-in</Link></div></section>}
  </>;
}
