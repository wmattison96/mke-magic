import { AppShell } from "@/components/app-shell";
import { PageHeading } from "@/components/ui";
import { AuthConfirmation } from "@/components/auth/auth-confirmation";

export default function AuthConfirmPage() {
  return <AppShell activePath="/tracking">
    <div className="mx-auto max-w-2xl">
      <PageHeading eyebrow="SECURE ACCOUNT ACCESS" title="Confirm your email" description="Use the secure link sent to your email to continue."/>
      <AuthConfirmation/>
    </div>
  </AppShell>;
}
