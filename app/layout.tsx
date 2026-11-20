import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mana Table | Playgroup Analytics",
  description: "A clear view of the players, decks, and games in your Magic: The Gathering playgroup.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="en" className="h-full antialiased"><body className="min-h-full">{children}</body></html>;
}
