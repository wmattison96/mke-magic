function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function guestNamePattern(name: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(name)}(?![\\p{L}\\p{N}])`, "giu");
}

/** Redacts exact guest-name tokens while preserving unrelated words and punctuation. */
export function redactGuestNames(text: string | null | undefined, names: string[]): string | null {
  if (text == null) return null;
  let safe = text;
  for (const name of [...new Set(names)].filter((value) => value.length >= 2).sort((a, b) => b.length - a.length)) {
    safe = safe.replace(guestNamePattern(name), "Guest");
  }
  return safe;
}

export function containsGuestName(text: string, names: string[]): boolean {
  return names.some((name) => name.length >= 2 && guestNamePattern(name).test(text));
}
