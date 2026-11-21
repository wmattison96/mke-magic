import test from "node:test";
import assert from "node:assert/strict";
import { parseCsv } from "../lib/historical/csv.mts";
import { getEligibility, validateHistoricalGame, validateManualGame } from "../lib/historical/model.ts";
import { containsGuestName, redactGuestNames } from "../lib/historical/privacy.mts";

function fixtureGame(overrides = {}) {
  return {
    gameId: "fixture-1",
    sourceGameKey: "fixture-source-1",
    playedOn: "2026-01-01",
    dateOrigin: "Explicit",
    podSize: 4,
    memberCount: 2,
    result: "single_winner",
    winnerSeat: 3,
    analyticsEligible: true,
    winStatsEligible: true,
    officialFourPlayerWinStatsEligible: true,
    ...overrides,
  };
}

function fixtureSeats(overrides = {}) {
  const seats = [
    { seat: 1, playerId: "will", deckId: "will-deck", commanderId: "cmd-a", isWinner: false, displayPlayer: "Member" },
    { seat: 2, playerId: "nelson", deckId: "nelson-deck", commanderId: "cmd-b", isWinner: false, displayPlayer: "Member" },
    { seat: 3, playerId: null, deckId: null, commanderId: "cmd-c", isWinner: true, displayPlayer: "Guest" },
    { seat: 4, playerId: null, deckId: null, commanderId: "cmd-d", isWinner: false, displayPlayer: "Guest" },
  ];
  return seats.map((seat) => ({ gameId: "fixture-1", sourceGameKey: "fixture-source-1", ...seat, ...overrides[seat.seat] }));
}

test("CSV parser handles BOM, commas, escaped quotes, and CRLF", () => {
  assert.deepEqual(parseCsv('\uFEFFname,note\r\nWill,"hello, table"\r\nManfred,"said ""go"""'), [
    { name: "Will", note: "hello, table" },
    { name: "Manfred", note: 'said "go"' },
  ]);
});

test("eligibility uses 2+ members, then single winner, then exactly four players", () => {
  const seats = fixtureSeats();
  assert.deepEqual(getEligibility(fixtureGame(), seats), {
    memberCount: 2,
    participationEligible: true,
    winStatsEligible: true,
    officialFourPlayerWinStatsEligible: true,
  });
  const threePlayer = seats.slice(0, 3);
  assert.equal(getEligibility(fixtureGame({ podSize: 3 }), threePlayer).officialFourPlayerWinStatsEligible, false);
  assert.equal(getEligibility(fixtureGame({ result: "draw", winnerSeat: null }), seats).winStatsEligible, false);
  assert.equal(getEligibility(fixtureGame({ memberCount: 1 }), seats.map((seat, index) => index === 1 ? { ...seat, playerId: null } : seat)).participationEligible, false);
});

test("manual game accepts a Guest winner without a member or deck ID", () => {
  const input = {
    podSize: 4,
    winnerSeat: 3,
    seats: fixtureSeats().map(({ seat, playerId, deckId, commanderId }) => ({ seat, playerId, deckId, commanderId, isGuest: playerId === null })),
    decks: [
      { deckId: "will-deck", playerId: "will", commanderId: "cmd-a" },
      { deckId: "nelson-deck", playerId: "nelson", commanderId: "cmd-b" },
    ],
  };
  assert.deepEqual(validateManualGame(input), []);
});

test("manual game accepts an unregistered member commander so a member deck can be created atomically", () => {
  const input = {
    podSize: 3,
    winnerSeat: 2,
    seats: [
      { seat: 1, isGuest: false, playerId: "will", deckId: null, commanderId: null, commanderName: "Scryfall canonical card name" },
      { seat: 2, isGuest: true, playerId: null, deckId: null, commanderId: "known-commander", commanderName: "Known Commander" },
      { seat: 3, isGuest: true, playerId: null, deckId: null, commanderId: null, commanderName: "Another canonical card" },
    ],
    decks: [],
  };
  assert.deepEqual(validateManualGame(input), []);
});

test("manual game rejects duplicate members, incomplete seat order, and missing winner", () => {
  const seats = fixtureSeats().map(({ seat, playerId, deckId, commanderId }) => ({ seat, playerId, deckId, commanderId, isGuest: playerId === null }));
  const invalid = validateManualGame({
    podSize: 4,
    winnerSeat: null,
    decks: [{ deckId: "will-deck", playerId: "nelson", commanderId: "other-commander" }],
    seats: [seats[0], { ...seats[1], seat: 1, playerId: seats[0].playerId }, seats[2], { ...seats[3], deckId: "wrong" }],
  });
  assert.ok(invalid.some((message) => message.includes("unique")));
  assert.ok(invalid.some((message) => message.includes("contiguous")));
  assert.ok(invalid.some((message) => message.includes("member can appear only once")));
  assert.ok(invalid.some((message) => message.includes("Guest seat")));
  assert.ok(invalid.some((message) => message.includes("deck they own")));
  assert.ok(invalid.some((message) => message.includes("commander does not match")));
  assert.ok(invalid.some((message) => message.includes("winning seat")));
});

test("historical draw, shared-winner, and missing-winner rows are preserved outside win denominators", () => {
  for (const result of ["draw", "shared_winner", "winner_missing"]) {
    const game = fixtureGame({ result, winnerSeat: null, winStatsEligible: false, officialFourPlayerWinStatsEligible: false });
    const seats = fixtureSeats().map((seat) => ({ ...seat, isWinner: false }));
    assert.deepEqual(validateHistoricalGame(game, seats), []);
    assert.equal(getEligibility(game, seats).participationEligible, true);
    assert.equal(getEligibility(game, seats).winStatsEligible, false);
  }
});

test("historical guest winner is counted by seat and passes eligibility", () => {
  assert.deepEqual(validateHistoricalGame(fixtureGame(), fixtureSeats()), []);
  assert.equal(fixtureSeats().find((seat) => seat.isWinner).playerId, null);
});

test("historical validation rejects impossible calendar dates", () => {
  const errors = validateHistoricalGame(fixtureGame({ playedOn: "2026-02-30" }), fixtureSeats());
  assert.ok(errors.some((message) => message.includes("Invalid date")));
});

test("public note redaction removes private guest names without matching substrings", () => {
  const safe = redactGuestNames("Ken won; Kenan played a different deck.", ["Ken"]);
  assert.equal(safe, "Guest won; Kenan played a different deck.");
  assert.equal(containsGuestName(safe, ["Ken"]), false);
});
