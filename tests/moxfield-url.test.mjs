import test from "node:test";
import assert from "node:assert/strict";
import { normalizeMoxfieldUrl } from "../lib/profiles/moxfield-url.ts";

test("Moxfield links accept only HTTPS URLs with the expected profile or deck path", () => {
  assert.equal(normalizeMoxfieldUrl("https://moxfield.com/users/FalcoCreed", "player"), "https://moxfield.com/users/FalcoCreed");
  assert.equal(normalizeMoxfieldUrl(" https://moxfield.com/decks/abc?utm_source=site#list ", "deck"), "https://moxfield.com/decks/abc");
  assert.equal(normalizeMoxfieldUrl("https://www.moxfield.com/users/Will/", "player"), "https://www.moxfield.com/users/Will/");
  assert.equal(normalizeMoxfieldUrl("", "player"), null);
  assert.equal(normalizeMoxfieldUrl(undefined, "deck"), undefined);
  assert.equal(normalizeMoxfieldUrl("http://moxfield.com/users/Will", "player"), undefined);
  assert.equal(normalizeMoxfieldUrl("https://example.com/users/Will", "player"), undefined);
  assert.equal(normalizeMoxfieldUrl("https://moxfield.com/decks/abc", "player"), undefined);
  assert.equal(normalizeMoxfieldUrl("https://moxfield.com/users/Will/decks", "player"), undefined);
  assert.equal(normalizeMoxfieldUrl("https://user:pass@moxfield.com/users/Will", "player"), undefined);
  assert.equal(normalizeMoxfieldUrl("https://moxfield.com:8443/users/Will", "player"), undefined);
});
