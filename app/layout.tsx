import type { Metadata } from "next";
import { SiteAnalytics } from "@/components/site-analytics";
import "./globals.css";

export const metadata: Metadata = {
  title: "MKE Magic | Playgroup Analytics",
  description: "MKE Magic gives your Magic: The Gathering playgroup a clear view of its players, decks, and games.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="en" className="h-full antialiased"><body className="min-h-full">{children}<SiteAnalytics/></body></html>;
}
