import { AppShell } from "@/components/app-shell";
import { PasswordUpdateForm } from "@/components/auth/password-update-form";
import { PageHeading } from "@/components/ui";

export default function UpdatePasswordPage() {
  return <AppShell activePath="/tracking">
    <div className="mx-auto max-w-2xl">
      <PageHeading eyebrow="SECURE ACCOUNT ACCESS" title="Set your password" description="Choose a password to finish account setup or regain access."/>
      <PasswordUpdateForm/>
    </div>
  </AppShell>;
}
