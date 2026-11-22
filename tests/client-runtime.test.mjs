import assert from "node:assert/strict";
import { test } from "node:test";
import { createClientId, withTimeout } from "../lib/client/async.ts";

test("client id uses randomUUID when the secure-context API is present", () => {
  const expected = "9e6f3354-4f48-4f3d-b8ba-c9b6f032be19";
  const value = createClientId({ randomUUID: () => expected, getRandomValues: () => { throw new Error("unused"); } });
  assert.equal(value, expected);
});

test("client id falls back to Web Crypto random values when randomUUID is unavailable", () => {
  const value = createClientId({ getRandomValues: (bytes) => {
    bytes.fill(0);
    return bytes;
  } });
  assert.match(value, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test("client id still has UUID shape in a browser without Web Crypto", () => {
  assert.match(createClientId(null), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test("withTimeout returns a settled result", async () => {
  assert.equal(await withTimeout(Promise.resolve("ready"), 100, "expired"), "ready");
});

test("withTimeout rejects a stalled request with the supplied message", async () => {
  await assert.rejects(
    withTimeout(new Promise(() => {}), 10, "account check timed out"),
    /account check timed out/,
  );
});
