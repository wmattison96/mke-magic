import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseCsv } from "../lib/historical/csv.mts";
import {
  buildDashboardStats,
  calculateMultiplayerEloDeltas,
  DEFAULT_PROVISIONAL_ELO_CONFIG,
  DASHBOARD_MINIMUM_PLAYER_GAMES,
  getDashboardWindow,
  getSiteToday,
} from "../lib/stats/dashboard.ts";

function game(id, playedOn, winnerSeat, participants, options = {}) {
  return {
    id,
    playedOn,
    gameNumberOnDate: options.gameNumberOnDate ?? 1,
    podSize: options.podSize ?? participants.length,
    result: options.result ?? "single_winner",
    winningSeat: winnerSeat,
    participants: participants.map(([seat, playerId, playerName, deckId, commanderName = deckId ?? "Guest commander"]) => ({
      seat,
      playerId,
      playerName,
      deckId,
      deckName: null,
      commanderName,
    })),
  };
}

const fixturePlayers = [
  { id: "will", name: "Will" },
  { id: "sam", name: "Sam" },
  { id: "keenan", name: "Keenan" },
];

const guestFixture = [
  game("g1", "2026-11-17", 1, [
    [1, "will", "Will", "will-a", "Will’s deck"], [2, "sam", "Sam", "sam-a", "Sam’s deck"], [3, null, "Guest", null], [4, null, "Guest", null],
  ]),
  game("g2", "2026-11-18", 2, [
    [1, "will", "Will", "will-a", "Will’s deck"], [2, "sam", "Sam", "sam-a", "Sam’s deck"], [3, "keenan", "Keenan", "keenan-a", "Keenan’s deck"], [4, null, "Guest", null],
  ]),
  game("g3", "2026-11-20", 3, [
    [1, "will", "Will", "will-a", "Will’s deck"], [2, "sam", "Sam", "sam-a", "Sam’s deck"], [3, null, "Guest", null], [4, null, "Guest", null],
  ]),
  game("one-member", "2026-11-20", 1, [
    [1, "will", "Will", "will-a"], [2, null, "Guest", null], [3, null, "Guest", null], [4, null, "Guest", null],
  ]),
  game("three-player", "2026-11-20", 1, [
    [1, "will", "Will", "will-a"], [2, "sam", "Sam", "sam-a"], [3, "keenan", "Keenan", "keenan-a"],
  ]),
  game("draw", "2026-11-20", 1, [
    [1, "will", "Will", "will-a"], [2, "sam", "Sam", "sam-a"], [3, null, "Guest", null], [4, null, "Guest", null],
  ], { result: "draw", winnerSeat: null }),
  game("outside-365", "2025-11-21", 1, [
    [1, "will", "Will", "will-a"], [2, "sam", "Sam", "sam-a"], [3, null, "Guest", null], [4, null, "Guest", null],
  ]),
];

test("Dashboard uses a consistent eligible four-player cohort and treats guest wins as member appearances only", () => {
  const stats = buildDashboardStats(guestFixture, fixturePlayers, "all", "2026-11-21");
  assert.equal(stats.gamesPlayed, 4);
  assert.equal(stats.activePlayers, 3);
  assert.equal(stats.uniqueDecksPlayed, 3);
  assert.deepEqual(stats.playerLeaderboard.map(({ name, games, wins, winRate }) => ({ name, games, wins, winRate })), [
    { name: "Will", games: 4, wins: 2, winRate: 0.5 },
    { name: "Sam", games: 4, wins: 1, winRate: 0.25 },
    { name: "Keenan", games: 1, wins: 0, winRate: 0 },
  ]);
  assert.equal(stats.recentGames[0].winnerName, "Guest (Seat 3)");
  assert.deepEqual(stats.hotPlayers, [], "Recent Form rankings also require 10 eligible games in the selected window.");
  assert.deepEqual(stats.coldPlayers, []);
  assert.deepEqual(stats.cumulative.map(({ games, uniqueDecks }) => [games, uniqueDecks]), [[1, 2], [2, 2], [3, 3], [4, 3]]);
  assert.equal(stats.deckDiversity.reduce((sum, owner) => sum + owner.share, 0), 1);
  assert.equal(stats.playersByWinRate.some((player) => player.name === "Guest"), false);
  assert.equal(stats.topDecksByWinRate.length, 0, "Deck rankings require five games in the selected period.");
  assert.equal(stats.topDecksByElo.length, 0, "Deck Elo rankings use the same five-game period minimum.");
  const allTimeWill = stats.playerLeaderboard.find((player) => player.id === "will");
  const recentWill = buildDashboardStats(guestFixture, fixturePlayers, "365", "2026-11-21").playerLeaderboard.find((player) => player.id === "will");
  assert.equal(recentWill.elo, allTimeWill.elo, "A date filter must not reset Elo at the period start.");
  assert.equal(recentWill.eloGames, 4, "Elo sample size remains chronological history through the period end.");
});

test("Rolling ranges include both boundary dates and all panels filter from the same window", () => {
  assert.deepEqual(getDashboardWindow("365", "2026-11-21"), { range: "365", startDate: "2025-11-22", endDate: "2026-11-21" });
  assert.deepEqual(getDashboardWindow("30", "2026-11-21"), { range: "30", startDate: "2026-10-23", endDate: "2026-11-21" });
  const stats = buildDashboardStats(guestFixture, fixturePlayers, "365", "2026-11-21");
  assert.equal(stats.gamesPlayed, 3);
  assert.equal(stats.uniqueDecksPlayed, 3);
  assert.equal(stats.recentGames.length, 3);
  assert.equal(stats.cumulative.at(-1)?.games, 3);
  const quiet = buildDashboardStats(guestFixture, fixturePlayers, "30", "2027-11-21");
  assert.equal(quiet.gamesPlayed, 0);
  assert.equal(quiet.activePlayers, 0);
  assert.equal(quiet.playerEloRankings.length, 0);
  assert.equal(quiet.recentGames.length, 0);
  assert.deepEqual(quiet.hotPlayers, []);
});

test("Provisional multiplayer Elo is zero-sum and rewards a later winner seat slightly more", () => {
  assert.deepEqual(DEFAULT_PROVISIONAL_ELO_CONFIG, {
    startingRating: 1000,
    kFactor: 24,
    seatOrderAdjustmentPerPosition: 0.03,
    minimumSeatFactor: 0.9,
    maximumSeatFactor: 1.1,
  });
  const seatOne = calculateMultiplayerEloDeltas([1000, 1000, 1000, 1000], 1);
  const seatFour = calculateMultiplayerEloDeltas([1000, 1000, 1000, 1000], 4);
  assert.ok(Math.abs(seatOne.reduce((sum, value) => sum + value, 0)) < 1e-10);
  assert.ok(Math.abs(seatFour.reduce((sum, value) => sum + value, 0)) < 1e-10);
  assert.ok(seatFour[3] > seatOne[0]);
  assert.equal(seatFour.length, 4);
});

test("Dashboard player performance displays require 10 games in the selected window", () => {
  assert.equal(DASHBOARD_MINIMUM_PLAYER_GAMES, 10);
  const tenGames = Array.from({ length: 10 }, (_, index) => game(
    `boundary-${index + 1}`,
    index === 9 ? "2026-09-30" : `2026-11-${String(index + 1).padStart(2, "0")}`,
    1,
    [
      [1, "will", "Will", "will-a", "Will’s deck"],
      [2, "sam", "Sam", "sam-a", "Sam’s deck"],
      [3, null, "Guest", null],
      [4, null, "Guest", null],
    ],
  ));

  const atNine = buildDashboardStats(tenGames.slice(0, 9), fixturePlayers, "all", "2026-11-21");
  assert.equal(atNine.activePlayers, 2, "Active Players still includes members with any eligible appearance.");
  assert.deepEqual(atNine.playerLeaderboard.map(({ name, games }) => [name, games]), [["Will", 9], ["Sam", 9]]);
  assert.deepEqual(atNine.playersByWinRate, []);
  assert.deepEqual(atNine.playerEloRankings, []);
  assert.deepEqual(atNine.hotPlayers, []);
  assert.deepEqual(atNine.coldPlayers, []);

  const atTen = buildDashboardStats(tenGames, fixturePlayers, "all", "2026-11-21");
  assert.equal(atTen.activePlayers, 2);
  assert.deepEqual(atTen.playersByWinRate.map(({ name, games }) => [name, games]), [["Will", 10], ["Sam", 10]]);
  assert.deepEqual(atTen.playerEloRankings.map(({ name, games }) => [name, games]), [["Will", 10], ["Sam", 10]]);
  assert.deepEqual(atTen.hotPlayers.map(({ name }) => name), ["Will"]);
  assert.deepEqual(atTen.coldPlayers.map(({ name }) => name), ["Sam"]);

  const selectedWindowHasNine = buildDashboardStats(tenGames, fixturePlayers, "30", "2026-11-21");
  assert.equal(selectedWindowHasNine.gamesPlayed, 9);
  assert.equal(selectedWindowHasNine.playerLeaderboard[0].games, 9);
  assert.deepEqual(selectedWindowHasNine.playersByWinRate, [], "The minimum is based on the selected window, not lifetime games.");
  assert.deepEqual(selectedWindowHasNine.playerEloRankings, []);
  assert.deepEqual(selectedWindowHasNine.hotPlayers, []);
  assert.deepEqual(selectedWindowHasNine.coldPlayers, []);
});

test("Deck rankings include five-game decks and omit four-game decks", () => {
  const games = [];
  for (let index = 0; index < 5; index += 1) {
    games.push(game(`ranked-${index}`, `2026-11-${String(index + 1).padStart(2, "0")}`, 1, [
      [1, "will", "Will", "ranked-deck", "Ranked commander"], [2, "sam", "Sam", `opponent-${index}`, "Opponent commander"], [3, null, "Guest", null], [4, null, "Guest", null],
    ]));
  }
  for (let index = 0; index < 4; index += 1) {
    games.push(game(`small-${index}`, `2026-11-${String(index + 10).padStart(2, "0")}`, 2, [
      [1, "will", "Will", `ranked-opponent-${index}`, "Opponent commander"], [2, "sam", "Sam", "four-game-deck", "Four-game commander"], [3, null, "Guest", null], [4, null, "Guest", null],
    ]));
  }
  const stats = buildDashboardStats(games, fixturePlayers, "all", "2026-11-21");
  assert.deepEqual(stats.topDecksByWinRate.map((deck) => [deck.id, deck.games]), [["ranked-deck", 5]]);
  assert.deepEqual(stats.topDecksByElo.map((deck) => [deck.id, deck.games]), [["ranked-deck", 5]]);
  assert.equal(getSiteToday(new Date("2026-11-21T05:30:00Z")), "2026-11-20", "The date boundary follows America/Chicago rather than UTC.");
});

test("Historical CSV baseline reconciles independently with Dashboard counts and member win rates", async () => {
  const root = resolve(process.cwd());
  const [playerText, gameText, participantText] = await Promise.all([
    readFile(resolve(root, "data/historical/players.csv"), "utf8"),
    readFile(resolve(root, "data/historical/games.csv"), "utf8"),
    readFile(resolve(root, "data/historical/game_participants.csv"), "utf8"),
  ]);
  const rawPlayers = parseCsv(playerText, "players.csv");
  const rawGames = parseCsv(gameText, "games.csv");
  const rawParticipants = parseCsv(participantText, "game_participants.csv");
  const participantsByGame = new Map();
  for (const row of rawParticipants) {
    const list = participantsByGame.get(row.game_id) ?? [];
    list.push(row);
    participantsByGame.set(row.game_id, list);
  }
  const dailyNumbers = new Map();
  const numbersBySourceKey = new Map();
  for (const row of [...rawGames].sort((a, b) => a.date.localeCompare(b.date) || a.source_game_key.localeCompare(b.source_game_key))) {
    const number = (dailyNumbers.get(row.date) ?? 0) + 1;
    dailyNumbers.set(row.date, number);
    numbersBySourceKey.set(row.source_game_key, number);
  }
  const resultMap = { "Single winner": "single_winner", Draw: "draw", "Shared winner": "shared_winner", "Winner missing": "winner_missing" };
  const statsGames = rawGames.map((row) => ({
    id: row.game_id,
    playedOn: row.date,
    gameNumberOnDate: numbersBySourceKey.get(row.source_game_key),
    podSize: Number(row.pod_size),
    result: resultMap[row.result],
    winningSeat: row.winner_seat ? Number(row.winner_seat) : null,
    participants: (participantsByGame.get(row.game_id) ?? []).map((seat) => ({
      seat: Number(seat.seat),
      playerId: seat.is_member === "1" ? seat.player_id : null,
      playerName: seat.is_member === "1" ? seat.display_player : "Guest",
      deckId: seat.is_member === "1" ? seat.deck_id : null,
      deckName: null,
      commanderName: seat.commander,
      isWinner: seat.is_winner === "1",
    })),
  }));
  const players = rawPlayers.map((player) => ({ id: player.player_id, name: player.name }));
  const dashboard = buildDashboardStats(statsGames, players, "all", "2026-11-21");

  // Independent acceptance path deliberately uses the raw CSV flags/columns,
  // not getEligibility or the Dashboard's grouped data.
  const eligibleCsvGames = rawGames.filter((row) => {
    const seats = participantsByGame.get(row.game_id) ?? [];
    return Number(row.pod_size) === 4
      && seats.filter((seat) => seat.is_member === "1").length >= 2
      && row.result === "Single winner"
      && Boolean(row.winner_seat);
  });
  const independentPlayers = new Map(players.map((player) => [player.id, { games: 0, wins: 0 }]));
  const independentDecks = new Set();
  for (const row of eligibleCsvGames) {
    for (const seat of participantsByGame.get(row.game_id) ?? []) {
      if (seat.is_member !== "1") continue;
      const count = independentPlayers.get(seat.player_id);
      count.games += 1;
      if (seat.is_winner === "1") count.wins += 1;
      independentDecks.add(seat.deck_id);
    }
  }
  const guestWinnerGames = eligibleCsvGames.filter((row) => {
    const winningSeat = (participantsByGame.get(row.game_id) ?? []).find((seat) => seat.seat === row.winner_seat);
    return winningSeat?.is_member === "0";
  });

  assert.equal(eligibleCsvGames.length, 97);
  assert.equal(dashboard.gamesPlayed, 97);
  assert.equal(dashboard.eligibleHistoryCount, 97);
  assert.equal(dashboard.activePlayers, [...independentPlayers.values()].filter((entry) => entry.games > 0).length);
  assert.equal(dashboard.uniqueDecksPlayed, independentDecks.size);
  assert.deepEqual(Object.fromEntries(dashboard.playerLeaderboard.map((player) => [player.name, player.elo])), {
    Nelson: 1020,
    Will: 990,
    Manfred: 993,
    Josh: 967,
    Sam: 1003,
  }, "Default Elo outputs must match the previously validated historical ratings.");
  assert.deepEqual(dashboard.playersByWinRate.map((player) => player.name), ["Will", "Nelson", "Manfred", "Josh"]);
  assert.deepEqual(dashboard.playerEloRankings.map((player) => player.name), ["Nelson", "Manfred", "Will", "Josh"]);
  assert.equal(dashboard.activePlayers, 5, "Sam remains included in Active Players with only three eligible games.");
  assert.equal(dashboard.playerLeaderboard.find((player) => player.name === "Sam")?.games, 3, "Sam’s underlying stats remain available.");
  for (const player of dashboard.playerLeaderboard) {
    const independent = independentPlayers.get(player.id);
    assert.ok(independent);
    assert.equal(player.games, independent.games, `Independent appearances reconciled for ${player.name}`);
    assert.equal(player.wins, independent.wins, `Independent wins reconciled for ${player.name}`);
    assert.equal(player.winRate, independent.games ? independent.wins / independent.games : null, `Independent rate reconciled for ${player.name}`);
  }
  assert.ok(guestWinnerGames.length > 0);
  for (const row of guestWinnerGames) {
    for (const seat of participantsByGame.get(row.game_id) ?? []) {
      if (seat.is_member === "1") assert.equal(seat.is_winner, "0", "A guest winner does not create a member win.");
    }
  }
});
