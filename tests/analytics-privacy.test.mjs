import assert from "node:assert/strict";
import { test } from "node:test";
import { sanitizeAnalyticsEvent } from "../lib/analytics/privacy.ts";

test("player and deck identities and query values are removed from pageview URLs", () => {
  assert.deepEqual(
    sanitizeAnalyticsEvent({ type: "pageview", url: "https://mkemagic.com/players/will?pods=4&email=private@example.com#details" }),
    { type: "pageview", url: "https://mkemagic.com/players/[player]" },
  );
  assert.deepEqual(
    sanitizeAnalyticsEvent({ type: "pageview", url: "https://mkemagic.com/decks/will-kinnan-bonder-prodigy?pods=4" }),
    { type: "pageview", url: "https://mkemagic.com/decks/[deck]" },
  );
});

test("public page paths remain useful while query strings and fragments are removed", () => {
  assert.deepEqual(
    sanitizeAnalyticsEvent({ type: "pageview", url: "https://mkemagic.com/games?date=2026-11-23#latest" }),
    { type: "pageview", url: "https://mkemagic.com/games" },
  );
});

test("malformed event URLs are dropped", () => {
  assert.equal(sanitizeAnalyticsEvent({ type: "pageview", url: "https://[invalid" }), null);
});
