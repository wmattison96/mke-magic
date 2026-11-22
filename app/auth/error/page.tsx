import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageHeading, Panel } from "@/components/ui";

export default function AuthErrorPage() {
  return <AppShell activePath="/tracking">
    <div className="mx-auto max-w-2xl">
      <PageHeading eyebrow="SECURE ACCOUNT ACCESS" title="That link could not be confirmed" description="The link may have expired, already been used, or could not reach Supabase."/>
      <Panel title="Continue account setup">
        <div className="flex flex-wrap gap-2 p-5 sm:p-6">
          <Link href="/auth/forgot-password" className="rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white">Request a new reset link</Link>
          <Link href="/tracking" className="rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-medium text-slate-600">Return to sign in</Link>
        </div>
      </Panel>
    </div>
  </AppShell>;
}
