import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv } from "../lib/historical/csv.mts";
import { buildDashboardStats } from "../lib/stats/dashboard.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [playerText, gameText, participantText] = await Promise.all([
  readFile(resolve(root, "data/historical/players.csv"), "utf8"),
  readFile(resolve(root, "data/historical/games.csv"), "utf8"),
  readFile(resolve(root, "data/historical/game_participants.csv"), "utf8"),
]);
const rawPlayers = parseCsv(playerText, "players.csv");
const rawGames = parseCsv(gameText, "games.csv");
const rawParticipants = parseCsv(participantText, "game_participants.csv");
const seatsByGame = new Map();
for (const row of rawParticipants) {
  const seats = seatsByGame.get(row.game_id) ?? [];
  seats.push(row);
  seatsByGame.set(row.game_id, seats);
}

const dailyNumbers = new Map();
const numberBySourceKey = new Map();
for (const row of [...rawGames].sort((a, b) => a.date.localeCompare(b.date) || a.source_game_key.localeCompare(b.source_game_key))) {
  const next = (dailyNumbers.get(row.date) ?? 0) + 1;
  dailyNumbers.set(row.date, next);
  numberBySourceKey.set(row.source_game_key, next);
}
const resultMap = { "Single winner": "single_winner", Draw: "draw", "Shared winner": "shared_winner", "Winner missing": "winner_missing" };
const games = rawGames.map((row) => ({
  id: row.game_id,
  playedOn: row.date,
  gameNumberOnDate: numberBySourceKey.get(row.source_game_key),
  podSize: Number(row.pod_size),
  result: resultMap[row.result],
  winningSeat: row.winner_seat ? Number(row.winner_seat) : null,
  participants: (seatsByGame.get(row.game_id) ?? []).map((seat) => ({
    seat: Number(seat.seat),
    playerId: seat.is_member === "1" ? seat.player_id : null,
    playerName: seat.is_member === "1" ? seat.display_player : "Guest",
    deckId: seat.is_member === "1" ? seat.deck_id : null,
    deckName: null,
    commanderName: seat.commander,
  })),
}));
const players = rawPlayers.map((player) => ({ id: player.player_id, name: player.name }));
const stats = buildDashboardStats(games, players, "all", "2026-11-21");

// Independent reconciliation from the source seat rows; this intentionally
// does not use the shared eligibility function or Dashboard grouping logic.
const eligible = rawGames.filter((game) => {
  const seats = seatsByGame.get(game.game_id) ?? [];
  return Number(game.pod_size) === 4
    && seats.filter((seat) => seat.is_member === "1").length >= 2
    && game.result === "Single winner"
    && Boolean(game.winner_seat);
});
assert.equal(eligible.length, 97, "The approved historical four-player baseline must contain 97 games.");
assert.equal(stats.gamesPlayed, eligible.length, "Dashboard game count must match independent CSV reconciliation.");
const independentPlayerStats = new Map(players.map((player) => [player.id, { games: 0, wins: 0 }]));
const independentDeckIds = new Set();
for (const game of eligible) {
  for (const seat of seatsByGame.get(game.game_id) ?? []) {
    if (seat.is_member !== "1") continue;
    const player = independentPlayerStats.get(seat.player_id);
    player.games += 1;
    if (seat.is_winner === "1") player.wins += 1;
    independentDeckIds.add(seat.deck_id);
  }
}
assert.equal(stats.activePlayers, [...independentPlayerStats.values()].filter((entry) => entry.games > 0).length);
assert.equal(stats.uniqueDecksPlayed, independentDeckIds.size);
for (const entry of stats.playerLeaderboard) {
  const independent = independentPlayerStats.get(entry.id);
  assert.deepEqual({ games: entry.games, wins: entry.wins, winRate: entry.winRate }, {
    games: independent.games,
    wins: independent.wins,
    winRate: independent.games ? independent.wins / independent.games : null,
  }, `Player rate must reconcile independently for ${entry.name}.`);
}

const recent = stats.recentGames.map((game) => `${game.playedOn} · ${game.winnerName} · ${game.winnerCommander}`);
console.log("PASS: Dashboard statistics reconcile against the approved historical CSV snapshot.");
console.log(`Cards: ${stats.activePlayers} active members · ${stats.gamesPlayed} eligible games · ${stats.uniqueDecksPlayed} distinct member-owned decks`);
console.log(`Eligible games: ${eligible.length} of 141 historical records · ${stats.playerLeaderboard.length} active members · ${stats.hotColdWindowGames} latest eligible games used for form`);
console.log("Player calculations (games / wins / win rate / provisional Elo):");
for (const player of stats.playerLeaderboard) {
  console.log(`  ${player.name}: ${player.games} / ${player.wins} / ${player.winRate === null ? "N/A" : `${(player.winRate * 100).toFixed(1)}%`} / ${player.elo ?? "N/A"} Elo (${player.eloGames} historical appearances)`);
}
console.log(`Top decks by eligible win rate (minimum 5): ${stats.topDecksByWinRate.map((deck) => `${deck.ownerName} · ${deck.name} (${(deck.winRate * 100).toFixed(1)}%, n=${deck.games})`).join("; ") || "none"}`);
console.log(`Top decks by provisional Elo (minimum 5): ${stats.topDecksByElo.map((deck) => `${deck.ownerName} · ${deck.name} (${deck.elo}, n=${deck.games})`).join("; ") || "none"}`);
console.log(`Latest eligible games: ${recent.join("; ")}`);
console.log(`Recent form: hot ${stats.hotPlayers.map((player) => `${player.name} ${player.wins}/${player.games}`).join(", ") || "insufficient data"}; cold ${stats.coldPlayers.map((player) => `${player.name} ${player.wins}/${player.games}`).join(", ") || "insufficient data"}`);
console.log("Independent member appearances, wins, win rates, active members, and unique deck IDs all reconciled.");
