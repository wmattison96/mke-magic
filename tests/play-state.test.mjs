import test from "node:test";
import assert from "node:assert/strict";
import {
  adjustCommanderDamage,
  adjustLife,
  commanderDamageKey,
  createPlaySession,
  getPlayDate,
  parsePlaySession,
  toPlayGameSubmission,
  validatePlaySetup,
} from "../lib/play/state.ts";

const submissionId = "11111111-1111-4111-8111-111111111111";
const setup = [
  { seat: 1, participantType: "member", playerId: "will", playerName: "Will", deckId: "deck-w", deckName: "W Deck", commanderId: "cmd-pair", commanderName: "Aesi, Tyrant of Gyre Strait / Thrasios, Triton Hero" },
  { seat: 2, participantType: "member", playerId: "manfred", playerName: "Manfred", deckId: "deck-m", deckName: "M Deck", commanderId: "cmd-m", commanderName: "Muldrotha, the Gravetide" },
  { seat: 3, participantType: "guest", playerId: null, playerName: null, deckId: null, deckName: null, commanderId: "cmd-g", commanderName: "Atraxa, Praetors' Voice" },
  { seat: 4, participantType: "guest", playerId: null, playerName: null, deckId: null, deckName: null, commanderId: "cmd-g2", commanderName: "Zada, Hedron Grinder" },
];

function session() {
  return createPlaySession({
    seats: setup,
    startedByPlayerId: "will",
    startedByPlayerName: "Will",
    playedOn: "2026-11-21",
    submissionId,
    sessionId: "22222222-2222-4222-8222-222222222222",
    startedAt: "2026-11-21T17:00:00.000Z",
  });
}

test("new game date follows the site's America/Chicago calendar", () => {
  assert.equal(getPlayDate(new Date("2026-11-21T05:30:00.000Z")), "2026-11-20");
  assert.equal(getPlayDate(new Date("2026-11-21T06:30:00.000Z")), "2026-11-21");
});

test("valid four-seat setup starts in seat order at 40 life and rejects duplicates or missing commanders", () => {
  assert.deepEqual(validatePlaySetup(setup), []);
  const active = session();
  assert.deepEqual(active.seats.map((seat) => seat.seat), [1, 2, 3, 4]);
  assert.deepEqual(Object.values(active.lifeTotals), [40, 40, 40, 40]);
  assert.deepEqual(active.seats[0].commanders.map((commander) => commander.name), ["Aesi, Tyrant of Gyre Strait", "Thrasios, Triton Hero"]);
  assert.equal(active.seats[0].commanders[0].id, "seat-1-commander-1");
  assert.equal(active.seats[0].commanders[1].id, "seat-1-commander-2");
  const duplicateMemberSetup = [{ ...setup[0] }, { ...setup[1], playerId: "will" }, ...setup.slice(2)];
  assert.ok(validatePlaySetup(duplicateMemberSetup).includes("Each member can only be seated once."));
  const noCommanderSetup = [{ ...setup[0], commanderName: null, commanderId: null }, ...setup.slice(1)];
  assert.ok(validatePlaySetup(noCommanderSetup).includes("Choose a commander for Seat 1."));
});

test("life controls allow totals to pass zero without ending the game", () => {
  let active = session();
  for (let index = 0; index < 41; index += 1) active = adjustLife(active, "seat-1", -1);
  assert.equal(active.lifeTotals["seat-1"], -1);
  active = adjustLife(active, "seat-1", 1);
  assert.equal(active.lifeTotals["seat-1"], 0);
  assert.equal(active.winningSeat, null);
});

test("commander damage is separate by target, source seat and partner commander; it adjusts life both ways", () => {
  let active = session();
  const aesiId = "seat-1-commander-1";
  const thrasiosId = "seat-1-commander-2";
  active = adjustCommanderDamage(active, "seat-3", aesiId, 1);
  active = adjustCommanderDamage(active, "seat-3", thrasiosId, 1);
  active = adjustCommanderDamage(active, "seat-4", aesiId, 1);
  assert.equal(active.commanderDamage[commanderDamageKey("seat-3", aesiId)], 1);
  assert.equal(active.commanderDamage[commanderDamageKey("seat-3", thrasiosId)], 1);
  assert.equal(active.commanderDamage[commanderDamageKey("seat-4", aesiId)], 1);
  assert.equal(active.lifeTotals["seat-3"], 38);
  assert.equal(active.lifeTotals["seat-4"], 39);
  active = adjustCommanderDamage(active, "seat-3", aesiId, -1);
  assert.equal(active.commanderDamage[commanderDamageKey("seat-3", aesiId)], 0);
  assert.equal(active.lifeTotals["seat-3"], 39);
  const unchanged = adjustCommanderDamage(active, "seat-3", aesiId, -1);
  assert.equal(unchanged, active, "damage cannot fall below zero or restore extra life");
  assert.equal(adjustCommanderDamage(active, "seat-1", aesiId, 1), active, "a player's commander cannot deal damage to that same player");
});

test("21 commander damage is represented independently and does not infer elimination", () => {
  let active = session();
  for (let index = 0; index < 21; index += 1) active = adjustCommanderDamage(active, "seat-3", "seat-2-commander-1", 1);
  assert.equal(active.commanderDamage[commanderDamageKey("seat-3", "seat-2-commander-1")], 21);
  assert.equal(active.lifeTotals["seat-3"], 19);
  assert.equal(active.winningSeat, null);
});

test("session restores from browser serialization and finished payload supports a Guest winner with stable idempotency", () => {
  const active = session();
  const finish = { ...active, notes: "Late night pod", winningSeat: 4 };
  const restored = parsePlaySession(JSON.stringify(finish));
  assert.deepEqual(restored, finish);
  const firstAttempt = toPlayGameSubmission(restored);
  const retry = toPlayGameSubmission(parsePlaySession(JSON.stringify(finish)));
  assert.deepEqual(firstAttempt, retry);
  assert.equal(firstAttempt.submissionId, submissionId);
  assert.equal(firstAttempt.winningSeat, 4);
  assert.equal(firstAttempt.seats[3].participantType, "guest");
  assert.equal(firstAttempt.seats[3].playerId, null);
  assert.equal(firstAttempt.seats.length, 4);
  assert.equal(toPlayGameSubmission(active), null, "a game requires a selected winner before submission");
});

test("persisted session validation rejects corrupt, duplicate-member and impossible damage state", () => {
  assert.equal(parsePlaySession("not json"), null);
  const duplicatedMembers = session();
  duplicatedMembers.seats[1] = { ...duplicatedMembers.seats[1], playerId: "will" };
  assert.equal(parsePlaySession(JSON.stringify(duplicatedMembers)), null);
  const invalidDamage = session();
  invalidDamage.commanderDamage[commanderDamageKey("seat-3", "seat-3-commander-1")] = 1;
  assert.equal(parsePlaySession(JSON.stringify(invalidDamage)), null);
});
