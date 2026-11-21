import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseCsv } from "../lib/historical/csv.mts";
import {
  buildAnalyticsPopulation,
  buildAnalyticsTrendSeries,
  buildAnalyticsTrendDefaults,
  buildColorAnalysis,
  buildDeckExpectedPerformance,
  buildPlayerExpectedPerformance,
  buildPlayerSeatStats,
  buildSeatPositionStats,
  isCoreFourGame,
  getQualifiedPlayerComparisons,
} from "../lib/stats/analytics.ts";
import { calculateEloHistory, buildDashboardStats } from "../lib/stats/dashboard.ts";
import { calculateDeckOpponentMatchups, calculatePlayerSharedMatchups } from "../lib/stats/matchups.ts";
import { combineCommanderColorIdentities } from "../lib/stats/profiles.ts";

const players = [
  { id: "will", name: "Will" },
  { id: "nelson", name: "Nelson" },
  { id: "manfred", name: "Manfred" },
  { id: "josh", name: "Josh" },
  { id: "sam", name: "Sam" },
  { id: "keenan", name: "Keenan" },
];

const decks = [
  { id: "will-deck", ownerId: "will", ownerName: "Will", commanderId: "partner-pair", commanderName: "Blue/Green Partners", name: "Blue/Green Partners", moxfieldUrl: null },
  { id: "nelson-deck", ownerId: "nelson", ownerName: "Nelson", commanderId: "mono-blue", commanderName: "Mono Blue", name: "Mono Blue", moxfieldUrl: null },
  { id: "manfred-deck", ownerId: "manfred", ownerName: "Manfred", commanderId: "colorless", commanderName: "Colorless Commander", name: "Colorless Commander", moxfieldUrl: null },
  { id: "josh-deck", ownerId: "josh", ownerName: "Josh", commanderId: "mono-red", commanderName: "Mono Red", name: "Mono Red", moxfieldUrl: null },
  { id: "sam-deck", ownerId: "sam", ownerName: "Sam", commanderId: "unknown", commanderName: "Unknown Commander", name: "Unknown Commander", moxfieldUrl: null },
  { id: "keenan-deck", ownerId: "keenan", ownerName: "Keenan", commanderId: "mono-green", commanderName: "Mono Green", name: "Mono Green", moxfieldUrl: null },
];

const deckByPlayer = new Map(decks.map((deck) => [deck.ownerId, deck]));
const playerById = new Map(players.map((player) => [player.id, player]));

function member(seat, playerId) {
  const player = playerById.get(playerId);
  const deck = deckByPlayer.get(playerId);
  return {
    seat, playerId, playerName: player.name, deckId: deck.id, deckName: deck.name,
    commanderId: deck.commanderId, commanderName: deck.commanderName,
  };
}

function guest(seat) {
  return { seat, playerId: null, playerName: "Guest", deckId: null, deckName: null, commanderId: "guest-commander", commanderName: "Guest commander" };
}

function game(id, playedOn, podSize, participants, winningSeat, result = "single_winner", gameNumberOnDate = 1) {
  return { id, playedOn, gameNumberOnDate, podSize, result, winningSeat: result === "single_winner" ? winningSeat : null, participants };
}

function coreGame(id, date, winnerSeat = 1) {
  return game(id, date, 4, [member(1, "nelson"), member(2, "will"), member(3, "manfred"), member(4, "josh")], winnerSeat);
}

test("expected wins use each actual pod size and guest wins never become member wins", () => {
  const games = [
    game("four", "2026-01-01", 4, [member(1, "will"), member(2, "manfred"), guest(3), guest(4)], 1),
    game("five", "2026-01-02", 5, [member(1, "nelson"), member(2, "will"), member(3, "sam"), guest(4), guest(5)], 3),
    game("six", "2026-01-03", 6, [member(1, "will"), member(2, "nelson"), member(3, "manfred"), guest(4), guest(5), guest(6)], 6),
    game("exception", "2026-01-04", 4, [member(1, "will"), member(2, "manfred"), guest(3), guest(4)], null, "draw"),
  ];
  const will = buildPlayerExpectedPerformance(games, players).find((row) => row.id === "will");
  const willDeck = buildDeckExpectedPerformance(games, decks).find((row) => row.id === "will-deck");
  const expected = 1 / 4 + 1 / 5 + 1 / 6;
  assert.equal(will.games, 3);
  assert.equal(will.wins, 1);
  assert.equal(will.expectedWins, expected);
  assert.ok(Math.abs(will.winSurplus - (1 - expected)) < 1e-12);
  assert.equal(willDeck.games, 3);
  assert.equal(willDeck.wins, 1);
  assert.ok(Math.abs(willDeck.expectedWins - expected) < 1e-12);
  assert.ok(Math.abs(willDeck.winSurplus - (1 - expected)) < 1e-12);
  assert.equal(buildPlayerExpectedPerformance(games, players).find((row) => row.id === "keenan").winRate, null);
});

test("Core Four filtering requires exactly the four registered members and respects date and pod filters", () => {
  const core = coreGame("core", "2026-01-10", 4);
  const guestSubstitution = game("substitution", "2026-01-10", 4, [member(1, "nelson"), member(2, "will"), member(3, "manfred"), guest(4)], 1);
  const threePlayer = game("three", "2026-01-10", 3, [member(1, "nelson"), member(2, "will"), member(3, "manfred")], 1);
  const oldCore = coreGame("old-core", "2024-01-01", 2);
  assert.equal(isCoreFourGame(core, players), true);
  assert.equal(isCoreFourGame(guestSubstitution, players), false);
  assert.equal(isCoreFourGame(threePlayer, players), false);

  const population = buildAnalyticsPopulation([core, guestSubstitution, threePlayer, oldCore], players, {
    podFilter: "4", range: "365", today: "2026-01-10", coreFourOnly: true,
  });
  assert.equal(population.coreFourOnlyApplied, true);
  assert.deepEqual(population.eligibleGames.map((row) => row.id), ["core"]);
  assert.equal(population.coreFourEligibleGames.length, 1);
  const fivePlus = buildAnalyticsPopulation([core, oldCore], players, {
    podFilter: "5plus", range: "all", today: "2026-01-10", coreFourOnly: true,
  });
  assert.equal(fivePlus.coreFourOnlyApplied, false);
  assert.deepEqual(fivePlus.eligibleGames, []);
});

test("player matchup matrix is directional and counts third-party and guest winners in the denominator", () => {
  const games = [
    game("will-wins", "2026-02-01", 4, [member(1, "will"), member(2, "nelson"), member(3, "manfred"), guest(4)], 1),
    game("nelson-wins", "2026-02-02", 4, [member(1, "will"), member(2, "nelson"), member(3, "manfred"), guest(4)], 2),
    game("third-party-wins", "2026-02-03", 4, [member(1, "will"), member(2, "nelson"), member(3, "manfred"), guest(4)], 3),
    game("guest-wins", "2026-02-04", 4, [member(1, "will"), member(2, "nelson"), member(3, "manfred"), guest(4)], 4),
  ];
  const matrix = calculatePlayerSharedMatchups(games, players);
  const willVsNelson = matrix.find((row) => row.playerId === "will" && row.opponentId === "nelson");
  const nelsonVsWill = matrix.find((row) => row.playerId === "nelson" && row.opponentId === "will");
  assert.deepEqual([willVsNelson.sharedGames, willVsNelson.wins, willVsNelson.winRate], [4, 1, .25]);
  assert.deepEqual([nelsonVsWill.sharedGames, nelsonVsWill.wins, nelsonVsWill.winRate], [4, 1, .25]);
  assert.deepEqual(willVsNelson.gameIds, ["will-wins", "nelson-wins", "third-party-wins", "guest-wins"]);
  assert.notEqual(willVsNelson.winRate, 1 - nelsonVsWill.winRate, "Third-party wins make these shared-pod rates non-complementary.");
});

test("deck matchup helper reuses directional shared-pod counts and deduplicates an opposing deck per game", () => {
  const games = [
    game("a-wins", "2026-03-01", 4, [member(1, "will"), member(2, "manfred"), guest(3), guest(4)], 1),
    game("b-wins", "2026-03-02", 4, [member(1, "will"), member(2, "manfred"), member(3, "sam"), guest(4)], 2),
    game("guest-wins", "2026-03-03", 4, [member(1, "will"), member(2, "manfred"), member(3, "manfred"), guest(4)], 4),
  ];
  const catalog = new Map(decks.map((deck) => [deck.id, deck]));
  const willRows = calculateDeckOpponentMatchups("will-deck", games, catalog);
  const manfredRows = calculateDeckOpponentMatchups("manfred-deck", games, catalog);
  const willVsManfred = willRows.find((row) => row.deckId === "manfred-deck");
  const manfredVsWill = manfredRows.find((row) => row.deckId === "will-deck");
  assert.deepEqual([willVsManfred.sharedGames, willVsManfred.wins, willVsManfred.winRate], [3, 1, 1 / 3]);
  assert.deepEqual([manfredVsWill.sharedGames, manfredVsWill.wins, manfredVsWill.winRate], [3, 1, 1 / 3]);
  assert.equal(willVsManfred.gameIds.length, 3);
});

test("color identities combine partners, distinguish colorless from unknown, and report appearances", () => {
  assert.deepEqual(combineCommanderColorIdentities([["G"], ["U"]]), ["U", "G"]);
  assert.deepEqual(combineCommanderColorIdentities([[]]), []);
  assert.equal(combineCommanderColorIdentities([["G"], null]), null);

  const games = [
    game("color-one", "2026-04-01", 4, [member(1, "will"), member(2, "manfred"), guest(3), guest(4)], 1),
    game("color-two", "2026-04-02", 3, [member(1, "will"), member(2, "sam"), guest(3)], 2),
    game("color-three", "2026-04-03", 5, [member(1, "will"), member(2, "sam"), guest(3), guest(4), guest(5)], 5),
  ];
  const metadata = new Map([
    ["partner-pair", { colors: ["U", "G"], artUrl: null }],
    ["colorless", { colors: [], artUrl: null }],
    ["unknown", { colors: null, artUrl: null }],
  ]);
  const summary = buildColorAnalysis(games, players, decks, metadata);
  assert.deepEqual([summary.totalDeckAppearances, summary.knownAppearances, summary.unknownAppearances], [6, 4, 2]);
  assert.deepEqual([summary.totalDecks, summary.knownDecks, summary.unknownDecks], [3, 2, 1]);
  assert.equal(summary.colorUsage.find((row) => row.color === "U").appearances, 3);
  assert.equal(summary.colorUsage.find((row) => row.color === "G").appearances, 3);
  assert.equal(summary.colorPerformance.find((row) => row.color === "U").winRate, 1 / 3);
  assert.equal(summary.identityDistribution.find((row) => row.bucket === "Two-color").appearances, 3);
  assert.equal(summary.identityDistribution.find((row) => row.bucket === "Colorless").appearances, 1);
  assert.equal(summary.playerPreferences.find((row) => row.playerId === "will").distinctColorsUsed, 2);
  assert.equal(summary.playerPreferences.find((row) => row.playerId === "sam").unknownAppearances, 2);
  assert.deepEqual(summary.playerPreferences.map((row) => row.playerName), ["Will", "Sam", "Manfred", "Josh", "Keenan", "Nelson"]);
  assert.deepEqual(summary.playerPreferences.map((row) => row.knownAppearances + row.unknownAppearances), [3, 2, 1, 0, 0, 0]);
});

test("seat win rates include guest winners and use actual expected shares for mixed pod sizes", () => {
  const games = [
    game("three", "2026-05-01", 3, [member(1, "will"), member(2, "manfred"), guest(3)], 1),
    game("four", "2026-05-02", 4, [member(1, "will"), member(2, "manfred"), guest(3), guest(4)], 4),
    game("five", "2026-05-03", 5, [member(1, "will"), member(2, "manfred"), guest(3), guest(4), guest(5)], 5),
    game("six", "2026-05-04", 6, [member(1, "will"), member(2, "manfred"), guest(3), guest(4), guest(5), guest(6)], 6),
  ];
  const seats = buildSeatPositionStats(games);
  assert.deepEqual(seats.map((row) => [row.seat, row.appearances, row.wins]), [[1, 4, 1], [2, 4, 0], [3, 4, 0], [4, 3, 1], [5, 2, 1], [6, 1, 1]]);
  assert.ok(Math.abs(seats[0].expectedWinRate - (1 / 3 + 1 / 4 + 1 / 5 + 1 / 6) / 4) < 1e-12);
  assert.equal(seats[4].winRate, .5, "The guest winner at seat 5 contributes to the seat's win numerator.");
  const willSeats = buildPlayerSeatStats(games, players).find((row) => row.playerId === "will").seats;
  assert.deepEqual(willSeats[0], { seat: 1, appearances: 4, wins: 1, expectedWins: 0, winRate: .25, expectedWinRate: null });
  assert.deepEqual(buildSeatPositionStats([]), []);
});

test("trends preserve historical Elo before the selected display window and wait for ten rolling appearances", () => {
  const games = Array.from({ length: 12 }, (_, index) => game(
    `trend-${index + 1}`,
    `2026-06-${String(index + 1).padStart(2, "0")}`,
    4,
    [member(1, "will"), member(2, "manfred"), guest(3), guest(4)],
    index % 2 === 0 ? 1 : 2,
  ));
  const playerElo = calculateEloHistory([...games].reverse(), "player");
  const deckElo = calculateEloHistory(games, "deck");
  const trends = buildAnalyticsTrendSeries(games, players, decks, playerElo, deckElo, "2026-06-04");
  const will = trends.players.find((series) => series.id === "will");
  const willDeck = trends.decks.find((series) => series.id === "will-deck");
  assert.equal(will.points[0].appearances, 4);
  assert.equal(will.points[0].cumulativeWins, 2);
  assert.equal(will.points[0].rollingWinRate, null, "A short selection is not reported as a full rolling-ten rate.");
  assert.equal(will.points.find((point) => point.appearances === 9).rollingWinRate, null);
  assert.equal(will.points.find((point) => point.appearances === 10).rollingWinRate, .5);
  assert.equal(will.points.at(-1).elo, Math.round(playerElo.history.get("will").at(-1).rating));
  assert.equal(willDeck.points.at(-1).elo, Math.round(deckElo.history.get("will-deck").at(-1).rating));
  assert.deepEqual(will.points.map((point) => point.playedOn), ["2026-06-04", "2026-06-05", "2026-06-06", "2026-06-07", "2026-06-08", "2026-06-09", "2026-06-10", "2026-06-11", "2026-06-12"]);
});

test("Player and Deck Elo remain chronological and deterministic for reordered source rows", () => {
  const games = Array.from({ length: 12 }, (_, index) => game(
    `elo-order-${index + 1}`,
    `2026-06-${String(index + 1).padStart(2, "0")}`,
    4,
    [member(1, "will"), member(2, "manfred"), member(3, "josh"), guest(4)],
    index % 4 === 1 ? 4 : index % 3 + 1,
  ));
  for (const identity of ["player", "deck"]) {
    const chronological = calculateEloHistory(games, identity);
    const reordered = calculateEloHistory([...games].reverse(), identity);
    assert.deepEqual([...reordered.ratings], [...chronological.ratings], `${identity} final ratings use chronological order.`);
    assert.deepEqual([...reordered.games], [...chronological.games], `${identity} appearance counts are deterministic.`);
    assert.deepEqual([...reordered.history], [...chronological.history], `${identity} history points are deterministic.`);
  }
});

test("player comparison eligibility changes at exactly ten eligible games", () => {
  const tenGames = Array.from({ length: 10 }, (_, index) => coreGame(
    `threshold-${index + 1}`,
    `2026-07-${String(index + 1).padStart(2, "0")}`,
    index % 4 + 1,
  ));
  const nineGameRows = buildPlayerExpectedPerformance(tenGames.slice(0, 9), players);
  const tenGameRows = buildPlayerExpectedPerformance(tenGames, players);

  for (const player of players.slice(0, 4)) {
    assert.equal(nineGameRows.find((row) => row.id === player.id).qualifiesForRanking, false, `${player.name} is hidden at nine eligible games.`);
    assert.equal(tenGameRows.find((row) => row.id === player.id).qualifiesForRanking, true, `${player.name} qualifies at ten eligible games.`);
  }
  assert.deepEqual(getQualifiedPlayerComparisons(nineGameRows), []);
  assert.deepEqual(getQualifiedPlayerComparisons(tenGameRows).map((row) => row.id).sort(), ["josh", "manfred", "nelson", "will"]);
});

test("trend defaults include every qualified player and focus only the selected deck", () => {
  const row = (id, games, ownerName = "", commanderName = id) => ({
    id, name: id, ownerName, commanderName, games, wins: 0, expectedWins: 0,
    winSurplus: 0, winRate: 0, expectedWinRate: 0, elo: 1000,
    qualifiesForRanking: games >= 5,
  });
  const series = (id, kind) => ({ id, name: id, kind, appearances: 10, points: [] });
  const playerRows = [row("p1", 18), row("p2", 16), row("p3", 14), row("p4", 12), row("p5", 11), row("p6", 10), row("p7", 9)];
  playerRows.forEach((item) => { item.qualifiesForRanking = item.games >= 10; });
  const deckRows = [
    row("d-1", 10, "Zed", "Alpha"),
    row("d-2", 10, "Ada", "Beta"),
    row("d-3", 8, "Moe", "Gamma"),
    row("d-4", 8, "Moe", "Delta"),
    row("d-5", 7, "Ari", "Epsilon"),
    row("d-6", 6, "Nia", "Zeta"),
    row("d-7", 4, "Will", "Below threshold"),
  ];
  const trends = {
    players: playerRows.map((item) => series(item.id, "player")),
    decks: deckRows.filter((item) => item.id !== "d-7").map((item) => series(item.id, "deck")),
  };
  const defaults = buildAnalyticsTrendDefaults(trends, playerRows, deckRows, "d-7");
  assert.deepEqual(defaults.playerSeries.map((item) => item.id), ["p1", "p2", "p3", "p4", "p5", "p6"]);
  assert.deepEqual(defaults.playerDefaultIds, ["p1", "p2", "p3", "p4", "p5", "p6"]);
  assert.deepEqual(defaults.deckSeries.map((item) => item.id), ["d-2", "d-1", "d-4", "d-3", "d-5", "d-6", "d-7"]);
  assert.deepEqual(defaults.deckDefaultIds, ["d-7"]);
  assert.equal(defaults.deckSeries.some((item) => item.id === "d-7"), true, "The focused four-game deck remains available below the general five-game threshold.");
  assert.deepEqual(defaults.deckSeries.at(-1), { id: "d-7", name: "d-7", kind: "deck", ownerName: "Will", commanderName: "Below threshold", appearances: 0, points: [] });

  const rankedFocus = buildAnalyticsTrendDefaults(trends, playerRows, deckRows, "d-2");
  assert.deepEqual(rankedFocus.deckDefaultIds, ["d-2"], "The focused deck alone is selected by default even when it meets the general threshold.");
  assert.equal(rankedFocus.deckSeries.length, 6, "All five-game comparison choices remain available.");
});

async function readHistoricalSnapshot() {
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
  const commanderNames = new Map(rawCommanders.map((row) => [row.commander_id, row.canonical_name]));
  const seatsByGame = new Map();
  for (const seat of rawSeats) {
    const rows = seatsByGame.get(seat.game_id) ?? [];
    rows.push(seat);
    seatsByGame.set(seat.game_id, rows);
  }
  const dailyNumbers = new Map();
  const gameNumbers = new Map();
  for (const row of [...rawGames].sort((a, b) => a.date.localeCompare(b.date) || a.source_game_key.localeCompare(b.source_game_key))) {
    const next = (dailyNumbers.get(row.date) ?? 0) + 1;
    dailyNumbers.set(row.date, next);
    gameNumbers.set(row.game_id, next);
  }
  const results = { "Single winner": "single_winner", Draw: "draw", "Shared winner": "shared_winner", "Winner missing": "winner_missing" };
  const games = rawGames.map((row) => ({
    id: row.game_id,
    playedOn: row.date,
    gameNumberOnDate: gameNumbers.get(row.game_id),
    podSize: Number(row.pod_size),
    result: results[row.result],
    winningSeat: row.winner_seat ? Number(row.winner_seat) : null,
    participants: (seatsByGame.get(row.game_id) ?? []).map((seat) => ({
      seat: Number(seat.seat),
      playerId: seat.is_member === "1" ? seat.player_id : null,
      playerName: seat.is_member === "1" ? seat.display_player : "Guest",
      deckId: seat.is_member === "1" ? seat.deck_id : null,
      deckName: null,
      commanderId: seat.commander_id,
      commanderName: commanderNames.get(seat.commander_id) ?? seat.commander,
    })),
  }));
  const members = rawPlayers.map((row) => ({ id: row.player_id, name: row.name, moxfieldUrl: row.moxfield_url || null }));
  const memberDecks = rawDecks.map((row) => ({
    id: row.deck_id,
    ownerId: row.player_id,
    ownerName: row.player,
    commanderId: row.commander_id,
    commanderName: commanderNames.get(row.commander_id) ?? row.commander,
    name: row.commander,
    moxfieldUrl: row.moxfield_deck_url || null,
  }));
  return { rawPlayers, rawGames, rawSeats, games, members, memberDecks };
}

test("historical four-player baselines reconcile independently against the supplied CSV snapshot", async () => {
  const snapshot = await readHistoricalSnapshot();
  const { rawGames, rawSeats, games, members, memberDecks } = snapshot;
  const population = buildAnalyticsPopulation(games, members, { podFilter: "4", range: "all", today: "2026-11-21", coreFourOnly: false });
  const sourceSeats = new Map();
  for (const row of rawSeats) {
    const rows = sourceSeats.get(row.game_id) ?? [];
    rows.push(row);
    sourceSeats.set(row.game_id, rows);
  }
  const independentEligible = rawGames.filter((row) => Number(row.pod_size) === 4
    && (sourceSeats.get(row.game_id) ?? []).filter((seat) => seat.is_member === "1").length >= 2
    && row.result === "Single winner"
    && Boolean(row.winner_seat));
  const coreIds = new Set(["nelson", "will", "manfred", "josh"]);
  const independentCoreGames = independentEligible.filter((row) => {
    const seats = sourceSeats.get(row.game_id) ?? [];
    return seats.length === 4 && seats.every((seat) => seat.is_member === "1")
      && new Set(seats.map((seat) => seat.player_id)).size === 4
      && seats.every((seat) => coreIds.has(seat.player_id));
  });
  const seatWins = new Map([[1, 0], [2, 0], [3, 0], [4, 0]]);
  for (const row of independentEligible) seatWins.set(Number(row.winner_seat), seatWins.get(Number(row.winner_seat)) + 1);
  const independentCoreWins = new Map([...coreIds].map((id) => [id, 0]));
  for (const row of independentCoreGames) {
    const winner = (sourceSeats.get(row.game_id) ?? []).find((seat) => seat.seat === row.winner_seat && seat.is_member === "1");
    independentCoreWins.set(winner.player_id, independentCoreWins.get(winner.player_id) + 1);
  }

  assert.equal(rawGames.length, 141);
  assert.equal(independentEligible.length, 97);
  assert.equal(population.eligibleGames.length, independentEligible.length);
  assert.equal(independentCoreGames.length, 69);
  assert.equal(population.coreFourEligibleGames.length, independentCoreGames.length);
  assert.deepEqual([...seatWins], [[1, 38], [2, 27], [3, 19], [4, 13]]);
  assert.deepEqual(buildSeatPositionStats(population.eligibleGames).map((row) => [row.seat, row.appearances, row.wins]), [
    [1, 97, 38], [2, 97, 27], [3, 97, 19], [4, 97, 13],
  ]);

  const corePerformance = buildPlayerExpectedPerformance(population.coreFourEligibleGames, members);
  assert.deepEqual([...independentCoreWins], [["nelson", 20], ["will", 19], ["manfred", 17], ["josh", 13]]);
  for (const [id, wins] of independentCoreWins) {
    assert.equal(corePerformance.find((row) => row.id === id).wins, wins);
  }

  const allPlayerPerformance = buildPlayerExpectedPerformance(population.eligibleGames, members);
  assert.deepEqual(getQualifiedPlayerComparisons(allPlayerPerformance).map((row) => row.name).sort(), ["Josh", "Manfred", "Nelson", "Will"]);
  const playerColorOrder = buildColorAnalysis(population.eligibleGames, members, memberDecks, new Map()).playerPreferences;
  const independentAppearances = new Map(members.map((member) => [member.id, 0]));
  const eligibleIds = new Set(independentEligible.map((row) => row.game_id));
  for (const seat of rawSeats) {
    if (eligibleIds.has(seat.game_id) && seat.is_member === "1") {
      independentAppearances.set(seat.player_id, independentAppearances.get(seat.player_id) + 1);
    }
  }
  const independentlySortedPlayers = [...members].sort((a, b) =>
    independentAppearances.get(b.id) - independentAppearances.get(a.id)
      || a.name.localeCompare(b.name)
      || a.id.localeCompare(b.id));
  assert.deepEqual(playerColorOrder.map((row) => row.playerId), independentlySortedPlayers.map((row) => row.id));
  assert.deepEqual(playerColorOrder.map((row) => row.knownAppearances + row.unknownAppearances), independentlySortedPlayers.map((row) => independentAppearances.get(row.id)));
  const surplusByName = new Map(allPlayerPerformance.map((row) => [row.name, row.winSurplus]));
  assert.deepEqual(Object.fromEntries([...surplusByName].filter(([name]) => ["Will", "Nelson", "Manfred", "Josh"].includes(name))), {
    Will: 2.75, Nelson: .75, Manfred: -2.25, Josh: -3.75,
  });

  const dashboard = buildDashboardStats(games, members, "all", "2026-11-21");
  const playerElo = calculateEloHistory(population.eligibleGames, "player");
  const deckElo = calculateEloHistory(population.eligibleGames, "deck");
  assert.deepEqual(dashboard.topDecksByElo.slice(0, 5).map(({ ownerName, name, elo }) => [ownerName, name, elo]), [
    ["Nelson", "Kinnan, Bonder Prodigy", 1037],
    ["Manfred", "Tymna the Weaver / Rograkh, Son of Rohgahh", 1031],
    ["Will", "Ketramose, the New Dawn", 1026],
    ["Josh", "Flubs, the Fool", 1024],
    ["Nelson", "Etali, Primal Conqueror", 1022],
  ], "Deck Elo remains at its pre-change K=24 historical baseline.");
  const trend = buildAnalyticsTrendSeries(population.historyGames, members, memberDecks, playerElo, deckElo, null);
  for (const player of dashboard.playerLeaderboard) {
    const series = trend.players.find((row) => row.id === player.id);
    assert.equal(series.points.at(-1).elo, player.elo, `${player.name} Analytics Elo matches the Dashboard Elo engine.`);
  }
});
