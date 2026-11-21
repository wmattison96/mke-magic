import "server-only";
import type { CommanderMetadata, ProfileDeck } from "@/lib/stats/profiles";

interface ScryfallCard {
  name?: string;
  color_identity?: string[];
  image_uris?: { art_crop?: string; normal?: string };
  card_faces?: Array<{ image_uris?: { art_crop?: string; normal?: string } }>;
}

let requestQueue: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;

function pacedRequest(url: URL): Promise<Response | null> {
  const request = requestQueue.then(async () => {
    const waitMs = Math.max(0, 125 - (Date.now() - lastRequestAt));
    if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
    lastRequestAt = Date.now();
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
  });
  requestQueue = request.then(() => undefined, () => undefined);
  return request;
}

async function lookupExactCard(name: string): Promise<ScryfallCard | null> {
  const url = new URL("https://api.scryfall.com/cards/named");
  url.searchParams.set("exact", name);
  const response = await pacedRequest(url);
  if (!response?.ok) return null;
  try {
    return await response.json() as ScryfallCard;
  } catch {
    return null;
  }
}

function artwork(card: ScryfallCard | null): string | null {
  if (!card) return null;
  return card.image_uris?.normal
    ?? card.card_faces?.[0]?.image_uris?.normal
    ?? card.image_uris?.art_crop
    ?? card.card_faces?.[0]?.image_uris?.art_crop
    ?? null;
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

  for (const commander of byCommander.values()) {
    const names = commander.name.split(/\s+\/\s+(?!\/)/).map((name) => name.trim()).filter(Boolean);
    const cards: ScryfallCard[] = [];
    for (const name of names) {
      const card = await lookupExactCard(name);
      if (!card) break;
      cards.push(card);
    }
    const colors = cards.length === names.length && cards.length > 0
      ? [...new Set(cards.flatMap((card) => card.color_identity ?? []))]
        .filter((color): color is "W" | "U" | "B" | "R" | "G" => ["W", "U", "B", "R", "G"].includes(color))
      : null;
    result.set(commander.id, { colors, artUrl: artwork(cards[0] ?? null) });
  }
  return result;
}
