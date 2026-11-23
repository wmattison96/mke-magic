import type { BeforeSendEvent } from "@vercel/analytics/next";

const fallbackOrigin = "https://mkemagic.com";

/** Keep traffic totals while removing query values and profile identity slugs. */
export function sanitizeAnalyticsEvent(event: BeforeSendEvent): BeforeSendEvent | null {
  try {
    const url = new URL(event.url, fallbackOrigin);
    const segments = url.pathname.split("/");

    if (segments[1] === "players" && segments[2]) {
      url.pathname = "/players/[player]";
    } else if (segments[1] === "decks" && segments[2]) {
      url.pathname = "/decks/[deck]";
    }

    url.search = "";
    url.hash = "";
    return { ...event, url: url.toString() };
  } catch {
    return null;
  }
}
