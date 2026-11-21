import { AppShell } from "@/components/app-shell";
import { TrackingWorkflow } from "@/components/tracking/tracking-workflow";
import { getTrackingCatalog } from "@/lib/data/tracking-catalog";

export default async function TrackingPage() {
  const catalog = await getTrackingCatalog();
  return <AppShell activePath="/tracking"><TrackingWorkflow catalog={catalog}/></AppShell>;
}
