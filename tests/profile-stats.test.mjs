import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  buildProfileStatistics,
  classifyDeckQuadrant,
  getDeckQuadrantAxisMax,
  getDeckQuadrantThreshold,
  PLAYER_COMPARISON_MINIMUM_GAMES,
  DECK_OPPONENT_DECK_MATCHUP_MINIMUM_GAMES,
  PLAYER_OPPONENT_DECK_MATCHUP_MINIMUM_GAMES,
  rankOpponentDeckMatchups,
  sortPlayerDirectoryProfiles,
} from "../lib/stats/profiles.ts";
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

const matchupPlayers = [
  { id: "will", name: "Will" },
  { id: "manfred", name: "Manfred" },
  { id: "sam", name: "Sam" },
  { id: "keenan", name: "Keenan" },
];
const matchupDecks = [
  { id: "will-main", ownerId: "will", ownerName: "Will", commanderId: "will-main", commanderName: "Will Main", name: "Will Main", moxfieldUrl: null },
  { id: "will-alt", ownerId: "will", ownerName: "Will", commanderId: "will-alt", commanderName: "Will Alternate", name: "Will Alternate", moxfieldUrl: null },
  { id: "opp-alpha", ownerId: "manfred", ownerName: "Manfred", commanderId: "opp-alpha", commanderName: "Alpha Commander", name: "Alpha Deck", moxfieldUrl: null },
  { id: "opp-beta", ownerId: "sam", ownerName: "Sam", commanderId: "opp-beta", commanderName: "Beta Commander", name: "Beta Deck", moxfieldUrl: null },
  { id: "opp-gamma", ownerId: "keenan", ownerName: "Keenan", commanderId: "opp-gamma", commanderName: "Gamma Commander", name: "Gamma Deck", moxfieldUrl: null },
  { id: "opp-delta", ownerId: "manfred", ownerName: "Manfred", commanderId: "opp-delta", commanderName: "Delta Commander", name: "Delta Deck", moxfieldUrl: null },
  { id: "opp-epsilon", ownerId: "sam", ownerName: "Sam", commanderId: "opp-epsilon", commanderName: "Epsilon Commander", name: "Epsilon Deck", moxfieldUrl: null },
  { id: "opp-zeta", ownerId: "keenan", ownerName: "Keenan", commanderId: "opp-zeta", commanderName: "Zeta Commander", name: "Zeta Deck", moxfieldUrl: null },
  { id: "opp-eta", ownerId: "manfred", ownerName: "Manfred", commanderId: "opp-eta", commanderName: "Eta Commander", name: "Eta Deck", moxfieldUrl: null },
  { id: "opp-theta", ownerId: "sam", ownerName: "Sam", commanderId: "opp-theta", commanderName: "Theta Commander", name: "Theta Deck", moxfieldUrl: null },
  { id: "opp-iota", ownerId: "keenan", ownerName: "Keenan", commanderId: "opp-iota", commanderName: "Iota Commander", name: "Iota Deck", moxfieldUrl: null },
];

function makeMatchupFixtures() {
  const deckById = new Map(matchupDecks.map((deck) => [deck.id, deck]));
  const playerById = new Map(matchupPlayers.map((player) => [player.id, player]));
  const fixtures = [];
  let gameNumber = 0;
  const makeMember = (seat, playerId, deckId) => ({
    seat,
    playerId,
    playerName: playerById.get(playerId).name,
    deckId,
    deckName: deckById.get(deckId).name,
    commanderId: deckById.get(deckId).commanderId,
    commanderName: deckById.get(deckId).commanderName,
  });
  const makeGuest = (seat) => ({ seat, playerId: null, playerName: "Guest", deckId: null, deckName: null, commanderId: null, commanderName: "Guest" });
  const addGame = ({ opponentDeckId, winnerSeat, podSize = 4, result = "single_winner", duplicateOpponent = false, includeOwnAlternate = false }) => {
    gameNumber += 1;
    const opponent = deckById.get(opponentDeckId);
    const roster = [makeMember(1, "will", "will-main"), makeMember(2, opponent.ownerId, opponentDeckId)];
    if (duplicateOpponent) roster.push(makeMember(3, opponent.ownerId, opponentDeckId));
    else if (includeOwnAlternate) roster.push(makeMember(3, "will", "will-alt"));
    while (roster.length < podSize) roster.push(makeGuest(roster.length + 1));
    fixtures.push({
      id: `matchup-${gameNumber}`,
      playedOn: new Date(Date.UTC(2026, 9, gameNumber)).toISOString().slice(0, 10),
      gameNumberOnDate: 1,
      podSize,
      result,
      winningSeat: result === "single_winner" ? winnerSeat : null,
      participants: roster,
    });
  };
  const schedules = [
    { deckId: "opp-alpha", games: 5, wins: 2, guestWin: 4, duplicateAt: 0, ownAlternateAt: 1 },
    { deckId: "opp-beta", games: 5, wins: 4 },
    { deckId: "opp-gamma", games: 6, wins: 1 },
    { deckId: "opp-delta", games: 5, wins: 0 },
    { deckId: "opp-epsilon", games: 5, wins: 5 },
    { deckId: "opp-zeta", games: 5, wins: 3 },
    { deckId: "opp-eta", games: 4, wins: 4 },
    { deckId: "opp-theta", games: 3, wins: 3 },
    { deckId: "opp-iota", games: 2, wins: 2 },
  ];
  for (const schedule of schedules) {
    for (let index = 0; index < schedule.games; index += 1) {
      const winnerSeat = index === schedule.guestWin ? 4 : index < schedule.wins ? 1 : 2;
      addGame({
        opponentDeckId: schedule.deckId,
        winnerSeat,
        duplicateOpponent: index === schedule.duplicateAt,
        includeOwnAlternate: index === schedule.ownAlternateAt,
      });
    }
  }
  addGame({ opponentDeckId: "opp-eta", winnerSeat: 4, podSize: 5 });
  addGame({ opponentDeckId: "opp-beta", winnerSeat: null, result: "draw" });
  return fixtures;
}

function makeDeckMatchupFixtures() {
  return makeMatchupFixtures().map((fixture) => ({
    ...fixture,
    participants: fixture.participants.map((entry) => entry.deckId === "will-alt"
      ? { seat: entry.seat, playerId: null, playerName: "Guest", deckId: null, deckName: null, commanderId: null, commanderName: "Guest" }
      : entry),
  }));
}

test("player directory sorting uses selected eligible games, then win rate and name", () => {
  const profile = (id, name, gamesPlayed, winRate) => ({
    player: { id, name },
    totals: { winEligibleGames: gamesPlayed, winRate },
  });
  const sorted = sortPlayerDirectoryProfiles([
    profile("will", "Will", 10, .4),
    profile("manfred", "Manfred", 10, .2),
    profile("andrea", "Andrea", 10, .4),
    profile("sam", "Sam", 5, .9),
    profile("keenan", "Keenan", 0, null),
    profile("aaron", "Aaron", 0, null),
  ]);
  assert.deepEqual(sorted.map((row) => row.player.name), ["Andrea", "Will", "Manfred", "Sam", "Aaron", "Keenan"]);

  const threePlayer = buildProfileStatistics(games, players, decks, "3");
  const fivePlus = buildProfileStatistics(games, players, decks, "5plus");
  assert.deepEqual(sortPlayerDirectoryProfiles(threePlayer.players.values()).map((row) => row.player.name).slice(0, 2), ["Will", "Manfred"]);
  assert.equal(sortPlayerDirectoryProfiles(fivePlus.players.values())[0].totals.winEligibleGames, 2);
});

test("deck quadrant uses the four-player threshold and selected-pod median with linear numeric bounds", () => {
  const fourPlayerPoints = [{ games: 1 }, { games: 3 }, { games: 38 }];
  assert.deepEqual(getDeckQuadrantThreshold(fourPlayerPoints, "4"), {
    games: 10,
    basis: "fixed-four-player",
    medianGames: null,
  });
  assert.equal(getDeckQuadrantAxisMax(fourPlayerPoints, 10), 40);

  assert.deepEqual(getDeckQuadrantThreshold([{ games: 1 }, { games: 1 }, { games: 3 }, { games: 4 }], "3"), {
    games: 2,
    basis: "selected-sample-median",
    medianGames: 2,
  });
  assert.equal(getDeckQuadrantThreshold([{ games: 1 }, { games: 1 }, { games: 1 }], "3").games, 2, "One-game-only samples need two appearances to count as frequent use.");
  assert.deepEqual(getDeckQuadrantThreshold([{ games: 1 }, { games: 2 }, { games: 3 }, { games: 4 }], "5plus"), {
    games: 3,
    basis: "selected-sample-median",
    medianGames: 2.5,
  });

  assert.equal(classifyDeckQuadrant({ games: 9, winRate: .26 }, 10, .25), "promising");
  assert.equal(classifyDeckQuadrant({ games: 10, winRate: .26 }, 10, .25), "proven-performer");
  assert.equal(classifyDeckQuadrant({ games: 9, winRate: .25 }, 10, .25), "underperforming-unproven");
  assert.equal(classifyDeckQuadrant({ games: 10, winRate: .25 }, 10, .25), "frequent-underperformer");
});

test("player opponent-deck matchups count eligible shared pods once, including guest wins", () => {
  const stats = buildProfileStatistics(makeMatchupFixtures(), matchupPlayers, matchupDecks, "4");
  const will = stats.players.get("will");
  const alpha = will.mostFacedDecks.find((row) => row.deckId === "opp-alpha");
  assert.equal(alpha.sharedGames, 5, "The same opposing deck listed twice in a pod counts once.");
  assert.equal(alpha.wins, 2, "A guest win remains in the denominator, not Will's win count.");
  assert.equal(alpha.winRate, 2 / 5);
  assert.equal(will.mostFacedDecks[0].deckId, "opp-gamma", "Most faced sorts by shared games, not win/loss totals.");
  assert.deepEqual(will.mostFacedDecks.slice(0, 3).map((row) => row.deckId), ["opp-gamma", "opp-zeta", "opp-alpha"], "Equal encounter counts use stable owner/deck alphabetical order.");
  assert.equal(will.mostFacedDecks.some((row) => row.deckId === "will-alt"), false, "The player's own decks are excluded.");
  assert.equal(will.bestMatchups.some((row) => row.deckId === "opp-eta"), false, "Four shared games do not meet the Player five-game minimum.");
  assert.equal(will.bestMatchups.some((row) => row.deckId === "opp-theta"), false, "Three shared games remain below the Player minimum.");
  assert.equal(PLAYER_OPPONENT_DECK_MATCHUP_MINIMUM_GAMES, 5);
  assert.equal(will.toughestMatchups.find((row) => row.deckId === "opp-alpha")?.sharedGames, 5, "Exactly five shared games qualify for Player matchup rankings.");
  assert.deepEqual(will.bestMatchups.map((row) => row.deckId), ["opp-epsilon", "opp-beta", "opp-zeta"]);
  assert.deepEqual(will.toughestMatchups.map((row) => row.deckId), ["opp-delta", "opp-gamma", "opp-alpha"]);
  assert.equal(new Set([...will.bestMatchups, ...will.toughestMatchups].map((row) => row.deckId)).size, 6, "Best and toughest lists are disjoint when six qualifying decks exist.");

  const fivePlus = buildProfileStatistics(makeMatchupFixtures(), matchupPlayers, matchupDecks, "5plus").players.get("will");
  assert.deepEqual(fivePlus.mostFacedDecks.map((row) => row.deckId), ["opp-eta"]);
  assert.equal(fivePlus.mostFacedDecks[0].sharedGames, 1);
  assert.equal(fivePlus.bestMatchups.length, 0);
  assert.equal(fivePlus.toughestMatchups.length, 0);
  const empty = buildProfileStatistics([], matchupPlayers, matchupDecks, "4").players.get("will");
  assert.deepEqual(empty.mostFacedDecks, []);
  assert.deepEqual(empty.bestMatchups, []);
  assert.deepEqual(empty.toughestMatchups, []);
});

test("opponent-deck ranking honors sample-size and stable alphabetical tie-breakers", () => {
  const makeRow = (deckId, ownerName, name, sharedGames, wins) => ({
    deckId, ownerId: ownerName, ownerName, name, commanderName: name, sharedGames, wins, winRate: wins / sharedGames,
  });
  const sampleTie = rankOpponentDeckMatchups([
    makeRow("first", "A", "First", 5, 5),
    makeRow("second", "A", "Second", 5, 4),
    makeRow("larger-tie", "A", "Zeta", 10, 6),
    makeRow("smaller-tie", "A", "Alpha", 5, 3),
    makeRow("low-one", "B", "One", 5, 1),
    makeRow("low-zero", "B", "Zero", 5, 0),
  ], { minimumSharedGames: PLAYER_OPPONENT_DECK_MATCHUP_MINIMUM_GAMES });
  assert.equal(sampleTie.best[2].deckId, "larger-tie", "Equal rates prefer the larger sample before alphabetical name.");
  assert.deepEqual(sampleTie.toughest.map((row) => row.deckId), ["low-zero", "low-one", "smaller-tie"]);
  const alphabeticalTie = rankOpponentDeckMatchups([
    makeRow("top-one", "A", "Top One", 5, 5),
    makeRow("top-two", "A", "Top Two", 5, 4),
    makeRow("tie-zeta", "Same Owner", "Zeta", 5, 3),
    makeRow("tie-alpha", "Same Owner", "Alpha", 5, 3),
  ], { minimumSharedGames: PLAYER_OPPONENT_DECK_MATCHUP_MINIMUM_GAMES });
  assert.equal(alphabeticalTie.best[2].deckId, "tie-alpha", "Equal rates and sample sizes use alphabetical deck name.");
  assert.deepEqual(rankOpponentDeckMatchups([], { minimumSharedGames: PLAYER_OPPONENT_DECK_MATCHUP_MINIMUM_GAMES }), { mostFaced: [], best: [], toughest: [] });
});

test("deck-versus-deck matchups use selected deck wins and eligible shared-pod samples", () => {
  const fixtureGames = makeDeckMatchupFixtures();
  const stats = buildProfileStatistics(fixtureGames, matchupPlayers, matchupDecks, "4");
  const willMain = stats.decks.get("will-main");
  const alpha = willMain.mostFacedDecks.find((row) => row.deckId === "opp-alpha");

  assert.equal(alpha.sharedGames, 5, "A repeated opposing deck counts once per game.");
  assert.equal(alpha.wins, 2, "Only games won by the selected deck are credited as its wins.");
  assert.equal(alpha.winRate, 2 / 5, "A guest winner remains in the shared-game denominator.");
  assert.equal(willMain.mostFacedDecks.some((row) => row.deckId === "will-main"), false, "The selected deck never appears as its own opponent.");
  assert.equal(DECK_OPPONENT_DECK_MATCHUP_MINIMUM_GAMES, 3);
  assert.equal(willMain.bestMatchups.find((row) => row.deckId === "opp-theta")?.sharedGames, 3, "Exactly three shared games meet the Deck Profile minimum.");
  assert.equal(willMain.bestMatchups.some((row) => row.deckId === "opp-iota"), false, "Two shared games do not meet the Deck Profile minimum.");
  assert.equal(willMain.toughestMatchups.some((row) => row.deckId === "opp-iota"), false);
  assert.deepEqual(willMain.bestMatchups.map((row) => row.deckId), ["opp-epsilon", "opp-eta", "opp-theta"]);
  assert.deepEqual(willMain.toughestMatchups.map((row) => row.deckId), ["opp-delta", "opp-gamma", "opp-alpha"]);
  assert.deepEqual(willMain.mostFacedDecks.slice(0, 3).map((row) => row.deckId), ["opp-gamma", "opp-zeta", "opp-alpha"], "Equal shared-game counts use stable owner and deck name tie-breakers.");

  const threeGameSample = fixtureGames.filter((game) => game.participants.some((entry) => entry.deckId === "opp-theta"));
  const threeGameDeck = buildProfileStatistics(threeGameSample, matchupPlayers, matchupDecks, "4").decks.get("will-main");
  assert.deepEqual(threeGameDeck.bestMatchups.map((row) => row.deckId), ["opp-theta"]);
  assert.deepEqual(threeGameDeck.toughestMatchups.map((row) => row.deckId), ["opp-theta"]);

  const twoGameSample = fixtureGames.filter((game) => game.participants.some((entry) => entry.deckId === "opp-iota"));
  const twoGameDeck = buildProfileStatistics(twoGameSample, matchupPlayers, matchupDecks, "4").decks.get("will-main");
  assert.deepEqual(twoGameDeck.bestMatchups, []);
  assert.deepEqual(twoGameDeck.toughestMatchups, []);

  const willPlayer = stats.players.get("will");
  assert.deepEqual(willPlayer.bestMatchups.map((row) => row.deckId), ["opp-epsilon", "opp-beta", "opp-zeta"], "Player matchups keep the existing five-game threshold.");
  assert.deepEqual(willPlayer.toughestMatchups.map((row) => row.deckId), ["opp-delta", "opp-gamma", "opp-alpha"]);

  const fivePlus = buildProfileStatistics(fixtureGames, matchupPlayers, matchupDecks, "5plus").decks.get("will-main");
  assert.deepEqual(fivePlus.mostFacedDecks.map((row) => row.deckId), ["opp-eta"]);
  assert.equal(fivePlus.mostFacedDecks[0].sharedGames, 1, "The pod-size selector filters encounter frequency consistently.");
  assert.deepEqual(fivePlus.bestMatchups, [], "A selected pod-size sample below three shared games has no ranked matchup.");
  assert.deepEqual(fivePlus.toughestMatchups, []);

  const empty = buildProfileStatistics([], matchupPlayers, matchupDecks, "4").decks.get("will-main");
  assert.deepEqual(empty.mostFacedDecks, []);
  assert.deepEqual(empty.bestMatchups, []);
  assert.deepEqual(empty.toughestMatchups, []);
});

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
  assert.equal(three.decks.get("will-arcades").quadrantExpectedWinRate, 1 / 3);
  assert.equal(four.winEligibleGames, 11);
  assert.equal(four.decks.get("will-arcades").quadrantExpectedWinRate, .25);
  assert.equal(fivePlus.totalGamesInPod, 2);
  assert.equal(fivePlus.players.get("will").expectedWinRate, (1 / 5 + 1 / 6) / 2);
  assert.equal(fivePlus.decks.get("will-arcades").quadrantExpectedWinRate, (1 / 5 + 1 / 6) / 2);
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
  assert.deepEqual(sortPlayerDirectoryProfiles(stats.players.values()).map((profile) => [profile.player.name, profile.totals.winEligibleGames]), [
    ["Nelson", 97], ["Will", 85], ["Manfred", 85], ["Josh", 83], ["Sam", 3], ["Keenan", 0],
  ]);
  assert.deepEqual([...stats.players.values()].filter((profile) => profile.competitiveRank !== null).map((profile) => profile.player.name).sort(), ["Josh", "Manfred", "Nelson", "Will"]);
  assert.ok(stats.deckDirectory.every((deck) => deck.rank === null || deck.winEligibleGames >= 5));
  assert.equal(stats.decks.size, 61, "Registered, unused member decks remain profile-accessible.");
});
