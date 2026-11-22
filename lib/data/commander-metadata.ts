import "server-only";
import { combineCommanderColorIdentities, type ColorIdentity, type CommanderMetadata, type ProfileDeck } from "@/lib/stats/profiles";

interface ScryfallCard {
  name?: string;
  color_identity?: string[];
  image_uris?: { art_crop?: string; normal?: string };
  card_faces?: Array<{ image_uris?: { art_crop?: string; normal?: string } }>;
}

let requestStartQueue: Promise<void> = Promise.resolve();
let lastRequestAt = 0;
const cardLookups = new Map<string, Promise<ScryfallCard | null>>();

function scheduleRequestStart(): Promise<void> {
  const scheduled = requestStartQueue.then(async () => {
    const now = performance.now();
    const waitMs = Math.max(0, 125 - (now - lastRequestAt));
    if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
    lastRequestAt = performance.now();
  });
  requestStartQueue = scheduled.then(() => undefined, () => undefined);
  return scheduled;
}

async function pacedRequest(url: URL): Promise<Response | null> {
  await scheduleRequestStart();
  try {
    return await fetch(url, {
      cache: "force-cache",
      next: { revalidate: 60 * 60 * 24 * 30 },
      headers: {
        Accept: "application/json;q=0.9,*/*;q=0.8",
        "User-Agent": "ManaTablePlaygroup/1.0 (commander metadata lookup)",
      },
      signal: AbortSignal.timeout(7000),
    });
  } catch {
    return null;
  }
}

function lookupExactCard(name: string): Promise<ScryfallCard | null> {
  const key = name.trim().toLocaleLowerCase();
  const cached = cardLookups.get(key);
  if (cached) return cached;

  const lookup = (async () => {
  const url = new URL("https://api.scryfall.com/cards/named");
  url.searchParams.set("exact", name);
  const response = await pacedRequest(url);
  if (!response?.ok) return null;
  try {
    return await response.json() as ScryfallCard;
  } catch {
    return null;
  }
  })();
  cardLookups.set(key, lookup);
  void lookup.then((card) => {
    if (card === null && cardLookups.get(key) === lookup) cardLookups.delete(key);
  });
  return lookup;
}

function artwork(card: ScryfallCard | null): string | null {
  if (!card) return null;
  return card.image_uris?.normal
    ?? card.card_faces?.[0]?.image_uris?.normal
    ?? card.image_uris?.art_crop
    ?? card.card_faces?.[0]?.image_uris?.art_crop
    ?? null;
}

/** Shares the existing paced, cached Scryfall lookup with Play's commander backgrounds. */
export async function getCommanderArtForName(name: string): Promise<string | null> {
  const normalized = name.trim();
  if (normalized.length < 2 || normalized.length > 80) return null;
  const imageUrl = artwork(await lookupExactCard(normalized));
  if (!imageUrl) return null;
  try {
    const parsed = new URL(imageUrl);
    return parsed.protocol === "https:" && parsed.hostname === "cards.scryfall.io" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function verifiedColors(card: ScryfallCard): ColorIdentity[] | null {
  const colors = card.color_identity;
  if (!Array.isArray(colors)) return null;
  if (colors.some((color) => !["W", "U", "B", "R", "G"].includes(color))) return null;
  return colors as ColorIdentity[];
}

/**
 * Looks up only commander identities already stored in the public registry.
 * Pair color identities are unioned; an unresolved partner leaves colors
 * unknown rather than incorrectly treating an incomplete result as colorless.
 */
export async function getCommanderMetadata(decks: ProfileDeck[]): Promise<Map<string, CommanderMetadata>> {
  const byCommander = new Map<string, { id: string; name: string }>();
  for (const deck of decks) byCommander.set(deck.commanderId, { id: deck.commanderId, name: deck.commanderName });
  const result = new Map<string, CommanderMetadata>();

  await Promise.all([...byCommander.values()].map(async (commander) => {
    const names = commander.name.split(/\s+\/\s+(?!\/)/).map((name) => name.trim()).filter(Boolean);
    const results = await Promise.all(names.map(lookupExactCard));
    const cards = results.filter((card): card is ScryfallCard => card !== null);
    const colors = cards.length === names.length && cards.length > 0
      ? combineCommanderColorIdentities(cards.map(verifiedColors))
      : null;
    result.set(commander.id, { colors, artUrl: artwork(results[0] ?? null) });
  }));
  return result;
}
