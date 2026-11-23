import assert from "node:assert/strict";
import { test } from "node:test";
import { sanitizeAnalyticsEvent } from "../lib/analytics/privacy.ts";

test("different public player profile UUIDs remain distinguishable without query values", () => {
  const first = sanitizeAnalyticsEvent({ type: "pageview", url: "https://mkemagic.com/players/11111111-1111-4111-8111-111111111111?pods=4&email=private@example.com#details" });
  const second = sanitizeAnalyticsEvent({ type: "pageview", url: "https://mkemagic.com/players/22222222-2222-4222-8222-222222222222" });

  assert.deepEqual(first, { type: "pageview", url: "https://mkemagic.com/players/11111111-1111-4111-8111-111111111111" });
  assert.deepEqual(second, { type: "pageview", url: "https://mkemagic.com/players/22222222-2222-4222-8222-222222222222" });
  assert.notEqual(first?.url, second?.url);
});

test("different public deck profile UUIDs remain distinguishable", () => {
  const first = sanitizeAnalyticsEvent({ type: "pageview", url: "https://mkemagic.com/decks/33333333-3333-4333-8333-333333333333?pods=4" });
  const second = sanitizeAnalyticsEvent({ type: "pageview", url: "https://mkemagic.com/decks/44444444-4444-4444-8444-444444444444" });

  assert.deepEqual(first, { type: "pageview", url: "https://mkemagic.com/decks/33333333-3333-4333-8333-333333333333" });
  assert.deepEqual(second, { type: "pageview", url: "https://mkemagic.com/decks/44444444-4444-4444-8444-444444444444" });
  assert.notEqual(first?.url, second?.url);
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

test("authentication, private, unknown, and non-UUID dynamic routes are not tracked", () => {
  for (const url of [
    "https://mkemagic.com/auth/confirm?token_hash=secret&type=invite",
    "https://mkemagic.com/auth/callback?code=secret",
    "https://mkemagic.com/tracking?email=private@example.com",
    "https://mkemagic.com/play#session=secret",
    "https://mkemagic.com/players/private@example.com",
    "https://mkemagic.com/decks/sensitive-dynamic-route",
    "https://mkemagic.com/internal/member/11111111-1111-4111-8111-111111111111",
  ]) {
    assert.equal(sanitizeAnalyticsEvent({ type: "pageview", url }), null, url);
  }
});
