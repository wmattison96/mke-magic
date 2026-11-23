import type { BeforeSendEvent } from "@vercel/analytics/next";

const fallbackOrigin = "https://mkemagic.com";
const publicPagePaths = new Set(["/", "/players", "/decks", "/games", "/analytics"]);
const uuidPathSegment = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Keep aggregate views for public routes while dropping private and unknown paths. */
export function sanitizeAnalyticsEvent(event: BeforeSendEvent): BeforeSendEvent | null {
  try {
    const url = new URL(event.url, fallbackOrigin);
    const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, "") : url.pathname;

    const playerProfile = path.match(/^\/players\/([^/]+)$/);
    const deckProfile = path.match(/^\/decks\/([^/]+)$/);
    const isPlayerUuid = playerProfile && uuidPathSegment.test(playerProfile[1]);
    const isDeckUuid = deckProfile && uuidPathSegment.test(deckProfile[1]);

    if (!publicPagePaths.has(path) && !isPlayerUuid && !isDeckUuid) {
      return null;
    }

    url.pathname = path;
    url.search = "";
    url.hash = "";
    return { ...event, url: url.toString() };
  } catch {
    return null;
  }
}
