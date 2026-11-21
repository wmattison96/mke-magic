import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildProfileStatistics, PLAYER_COMPARISON_MINIMUM_GAMES } from "../lib/stats/profiles.ts";
import { buildDashboardStats } from "../lib/stats/dashboard.ts";
import { parseCsv } from "../lib/historical/csv.mts";

const players = [
  { id: "will", name: "Will", moxfieldUrl: "https://moxfield.com/users/wmattison" },
  { id: "manfred", name: "Manfred" },
  { id: "sam", name: "Sam" },
  { id: "keenan", name: "Keenan" },
];

const decks = [
  { id: "will-arcades", ownerId: "will", ownerName: "Will", commanderId: "arcades", commanderName: "Arcades, the Strategist", name: "Arcades, the Strategist", moxfieldUrl: null },
  { id: "manfred-arcades", ownerId: "manfred", ownerName: "Manfred", commanderId: "arcades", commanderName: "Arcades, the Strategist", name: "Arcades, the Strategist", moxfieldUrl: null },
  { id: "sam-new", ownerId: "sam", ownerName: "Sam", commanderId: "unknown-commander", commanderName: "New Commander", name: "New Commander", moxfieldUrl: null },
  { id: "will-unused", ownerId: "will", ownerName: "Will", commanderId: "unused-commander", commanderName: "Unused Commander", name: "Unused Commander", moxfieldUrl: null },
];

function participant(seat, playerId, deckId, playerName = playerId ? players.find((player) => player.id === playerId)?.name : "Guest", commanderId = "arcades", commanderName = "Arcades, the Strategist") {
  return { seat, playerId, playerName, deckId, deckName: deckId ? decks.find((deck) => deck.id === deckId)?.name ?? null : null, commanderId, commanderName };
}

function game(id, date, podSize, participants, winner, result = "single_winner") {
  return { id, playedOn: date, gameNumberOnDate: Number(id.match(/\d+$/)?.[0] ?? 1), podSize, result, winningSeat: result === "single_winner" ? winner : null, participants };
}

const games = Array.from({ length: 10 }, (_, index) => {
  const winner = index === 8 ? 3 : index === 9 ? 2 : 1;
  return game(`four-${index + 1}`, `2026-11-${String(index + 1).padStart(2, "0")}`, 4, [
    participant(1, "will", "will-arcades"),
    participant(2, "manfred", "manfred-arcades"),
    participant(3, null, null, "Guest", "guest-commander", "Guest commander"),
    participant(4, null, null, "Guest", "other-guest-commander", "Other guest commander"),
  ], winner);
});

games.push(
  game("draw-11", "2026-11-11", 4, [participant(1, "will", "will-arcades"), participant(2, "manfred", "manfred-arcades"), participant(3, null, null), participant(4, null, null)], null, "draw"),
  game("under-threshold-12", "2026-11-12", 4, [participant(1, "will", "will-arcades"), participant(2, null, null), participant(3, null, null), participant(4, null, null)], 1),
  game("sam-13", "2026-11-13", 4, [participant(1, "sam", "sam-new", "Sam", "unknown-commander", "New Commander"), participant(2, "will", "will-arcades"), participant(3, null, null), participant(4, null, null)], 3),
  game("three-player-1", "2026-11-14", 3, [participant(1, "will", "will-arcades"), participant(2, "manfred", "manfred-arcades"), participant(3, null, null)], 1),
  game("five-player-1", "2026-11-15", 5, [participant(1, "will", "will-arcades"), participant(2, "manfred", "manfred-arcades"), participant(3, null, null), participant(4, null, null), participant(5, null, null)], 5),
  game("six-player-2", "2026-11-16", 6, [participant(1, "will", "will-arcades"), participant(2, "manfred", "manfred-arcades"), participant(3, null, null), participant(4, null, null), participant(5, null, null), participant(6, null, null)], 2),
);

test("player profiles separate recorded appearances, 2+ member appearances, and win denominators", () => {
  const stats = buildProfileStatistics(games, players, decks, "4", new Map([
    ["arcades", { colors: ["W", "U"], artUrl: "https://cards.scryfall.io/normal/example.jpg" }],
  ]));
  assert.equal(stats.totalGamesInPod, 13);
  assert.equal(stats.participationEligibleGames, 12);
  assert.equal(stats.winEligibleGames, 11);
  assert.equal(stats.officialFourPlayerGames, 11);
  assert.equal(stats.players.size, 4, "All rostered players remain available, including Keenan with no history.");

  const will = stats.players.get("will");
  assert.equal(will.totals.recordedAppearances, 13);
  assert.equal(will.totals.participationEligibleAppearances, 12);
  assert.equal(will.totals.winEligibleGames, 11);
  assert.equal(will.totals.wins, 8, "Guest wins count as member appearances, never member wins.");
  assert.equal(will.meetsComparisonMinimum, true);
  assert.equal(will.competitiveRank, 1);
  assert.equal(will.expectedWinRate, .25);
  assert.deepEqual(will.colorsByDeck.rows.map((row) => [row.color, row.share]), [["W", .5], ["U", .5]]);
  assert.equal(will.colorsByDeck.totalEntities, 1);
  assert.equal(will.colorsByDeck.unknownEntities, 0);

  const sam = stats.players.get("sam");
  assert.equal(sam.totals.winEligibleGames, 1);
  assert.equal(sam.totals.wins, 0, "A guest victory is a loss for a member participant.");
  assert.equal(sam.competitiveRank, null, "The 10-game minimum only affects comparative rankings.");
  assert.equal(sam.eloGames, 1);
  assert.ok(sam.recentGames.some((entry) => entry.outcome === "Lost"));
  assert.ok(will.recentGames.some((entry) => entry.outcome === "Noncompetitive"), "A below-threshold single-winner record is retained but labeled noncompetitive.");

  const keenan = stats.players.get("keenan");
  assert.deepEqual(keenan.totals, { recordedAppearances: 0, participationEligibleAppearances: 0, winEligibleGames: 0, wins: 0, winRate: null });
  assert.equal(keenan.elo, null);
  assert.equal(keenan.recentGames.length, 0);
});

test("deck identity remains owner plus commander and guests never become deck profiles", () => {
  const stats = buildProfileStatistics(games, players, decks, "4");
  const willDeck = stats.decks.get("will-arcades");
  const manfredDeck = stats.decks.get("manfred-arcades");
  assert.equal(willDeck.deck.commanderId, manfredDeck.deck.commanderId);
  assert.notEqual(willDeck.deck.id, manfredDeck.deck.id);
  assert.equal(willDeck.totals.winEligibleGames, 11);
  assert.equal(willDeck.totals.wins, 8);
  assert.equal(manfredDeck.totals.winEligibleGames, 10);
  assert.equal(manfredDeck.totals.wins, 1);
  assert.ok(willDeck.elo !== manfredDeck.elo, "Deck Elo is tracked independently for each owner.");
  assert.equal(willDeck.meetsRankingMinimum, true);
  assert.equal(stats.decks.has("guest-commander"), false);
  assert.equal(stats.decks.get("will-unused").totals.winEligibleGames, 0);
  assert.equal(stats.decks.get("will-unused").elo, null);
  assert.equal(stats.decks.get("will-unused").recentGames.length, 0);
});

test("pod-size filters remain separate and 5+ expected share uses each actual pod size", () => {
  const three = buildProfileStatistics(games, players, decks, "3");
  const four = buildProfileStatistics(games, players, decks, "4");
  const fivePlus = buildProfileStatistics(games, players, decks, "5plus");
  assert.equal(three.totalGamesInPod, 1);
  assert.equal(three.players.get("will").expectedWinRate, 1 / 3);
  assert.equal(four.winEligibleGames, 11);
  assert.equal(fivePlus.totalGamesInPod, 2);
  assert.equal(fivePlus.players.get("will").expectedWinRate, (1 / 5 + 1 / 6) / 2);
  assert.equal(fivePlus.players.get("will").eloGames, 2);
  assert.equal(PLAYER_COMPARISON_MINIMUM_GAMES, 10);
});

test("all six player and 61 owner+commander deck profiles reconcile to the historical CSV baseline", async () => {
  const root = resolve(process.cwd(), "data/historical");
  const [playerText, commanderText, deckText, gameText, participantText] = await Promise.all([
    readFile(resolve(root, "players.csv"), "utf8"),
    readFile(resolve(root, "commander_registry.csv"), "utf8"),
    readFile(resolve(root, "member_decks.csv"), "utf8"),
    readFile(resolve(root, "games.csv"), "utf8"),
    readFile(resolve(root, "game_participants.csv"), "utf8"),
  ]);
  const rawPlayers = parseCsv(playerText, "players.csv");
  const rawCommanders = parseCsv(commanderText, "commander_registry.csv");
  const rawDecks = parseCsv(deckText, "member_decks.csv");
  const rawGames = parseCsv(gameText, "games.csv");
  const rawSeats = parseCsv(participantText, "game_participants.csv");
  const commandNames = new Map(rawCommanders.map((row) => [row.commander_id, row.canonical_name]));
  const seatsByGame = new Map();
  for (const row of rawSeats) {
    const rows = seatsByGame.get(row.game_id) ?? [];
    rows.push(row);
    seatsByGame.set(row.game_id, rows);
  }
  const dailyNumbers = new Map();
  const gameNumbers = new Map();
  for (const row of [...rawGames].sort((a, b) => a.date.localeCompare(b.date) || a.source_game_key.localeCompare(b.source_game_key))) {
    const number = (dailyNumbers.get(row.date) ?? 0) + 1;
    dailyNumbers.set(row.date, number);
    gameNumbers.set(row.game_id, number);
  }
  const resultTypes = { "Single winner": "single_winner", Draw: "draw", "Shared winner": "shared_winner", "Winner missing": "winner_missing" };
  const games = rawGames.map((row) => ({
    id: row.game_id,
    playedOn: row.date,
    gameNumberOnDate: gameNumbers.get(row.game_id),
    podSize: Number(row.pod_size),
    result: resultTypes[row.result],
    winningSeat: row.winner_seat ? Number(row.winner_seat) : null,
    participants: (seatsByGame.get(row.game_id) ?? []).map((seat) => ({
      seat: Number(seat.seat),
      playerId: seat.is_member === "1" ? seat.player_id : null,
      playerName: seat.is_member === "1" ? seat.display_player : "Guest",
      deckId: seat.is_member === "1" ? seat.deck_id : null,
      deckName: null,
      commanderId: seat.commander_id,
      commanderName: commandNames.get(seat.commander_id) ?? seat.commander,
    })),
  }));
  const members = rawPlayers.map((player) => ({ id: player.player_id, name: player.name, moxfieldUrl: player.moxfield_url || null }));
  const decksFromCsv = rawDecks.map((deck) => ({
    id: deck.deck_id,
    ownerId: deck.player_id,
    ownerName: deck.player,
    commanderId: deck.commander_id,
    commanderName: commandNames.get(deck.commander_id) ?? deck.commander,
    name: deck.commander,
    moxfieldUrl: deck.moxfield_deck_url || null,
  }));
  const stats = buildProfileStatistics(games, members, decksFromCsv, "4");
  const dashboard = buildDashboardStats(games, members, "all", "2026-11-21");

  assert.equal(games.length, 141);
  assert.equal(members.length, 6);
  assert.equal(decksFromCsv.length, 61);
  assert.equal(stats.totalGamesInPod, 123);
  assert.equal(stats.participationEligibleGames, 100);
  assert.equal(stats.winEligibleGames, 97);
  assert.equal(stats.officialFourPlayerGames, 97);
  assert.equal(stats.deckDirectory.length, 61);
  assert.equal(stats.deckDirectory.filter((deck) => deck.winEligibleGames > 0).length, 58);
  assert.equal(stats.deckDirectory.every((deck) => rawDecks.some((source) => source.deck_id === deck.id && source.player_id === deck.ownerId && source.commander_id === deck.commanderId)), true);

  const expected = new Map([
    ["nelson", [97, 25]], ["will", [85, 24]], ["manfred", [85, 19]], ["josh", [83, 17]], ["sam", [3, 1]], ["keenan", [0, 0]],
  ]);
  for (const [id, [eligibleGames, wins]] of expected) {
    const profile = stats.players.get(id);
    assert.ok(profile, `The member ${id} has a profile, even without games.`);
    assert.equal(profile.totals.winEligibleGames, eligibleGames, `${id} eligible games reconcile`);
    assert.equal(profile.totals.wins, wins, `${id} wins reconcile`);
    assert.equal(profile.elo, dashboard.playerLeaderboard.find((row) => row.id === id)?.elo ?? null, `${id} profile Elo reuses the Dashboard engine`);
    assert.equal(profile.meetsComparisonMinimum, eligibleGames >= 10);
  }
  assert.deepEqual([...stats.players.values()].filter((profile) => profile.competitiveRank !== null).map((profile) => profile.player.name).sort(), ["Josh", "Manfred", "Nelson", "Will"]);
  assert.ok(stats.deckDirectory.every((deck) => deck.rank === null || deck.winEligibleGames >= 5));
  assert.equal(stats.decks.size, 61, "Registered, unused member decks remain profile-accessible.");
});
