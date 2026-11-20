import { AppShell } from "@/components/app-shell";
import { DashboardHome } from "@/components/dashboard-home";

export default function Home() {
  return <AppShell activePath="/"><DashboardHome/></AppShell>;
}
