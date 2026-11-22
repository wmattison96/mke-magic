import { AppShell } from "@/components/app-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { PageHeading } from "@/components/ui";

export default function ForgotPasswordPage() {
  return <AppShell activePath="/tracking">
    <div className="mx-auto max-w-2xl">
      <PageHeading eyebrow="SECURE ACCOUNT ACCESS" title="Reset your password" description="Request a one-time password reset email for your MKE Magic account."/>
      <ForgotPasswordForm/>
    </div>
  </AppShell>;
}
