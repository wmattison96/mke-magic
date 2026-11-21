export type MoxfieldRecordType = "player" | "deck";

/** Accept only the canonical HTTPS URL shape for a member profile or deck. */
export function normalizeMoxfieldUrl(raw: string | null | undefined, type: MoxfieldRecordType): string | null | undefined {
  const value = raw?.trim();
  if (value === undefined) return undefined;
  if (!value) return null;
  try {
    const url = new URL(value);
    const hostIsMoxfield = url.protocol === "https:"
      && (url.hostname === "moxfield.com" || url.hostname === "www.moxfield.com")
      && url.port === ""
      && !url.username
      && !url.password;
    const validPath = type === "player" ? /^\/users\/[^/]+\/?$/.test(url.pathname) : /^\/decks\/[^/]+\/?$/.test(url.pathname);
    if (!hostIsMoxfield || !validPath) return undefined;
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return undefined;
  }
}
