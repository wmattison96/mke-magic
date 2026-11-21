import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv } from "../lib/historical/csv.mts";
import { getEligibility, validateHistoricalGame } from "../lib/historical/model.mts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = resolve(root, "data/historical");
const expected = {
  historical_games: 141,
  seats_logged: 565,
  member_players: 6,
  guest_seat_appearances: 131,
  games_with_2plus_members: 114,
  games_with_2plus_members_and_single_winner: 111,
  official_four_player_single_winner_games: 97,
  excluded_less_than_two_members: 27,
  games_draw_or_shared_or_missing_winner: 3,
  date_carried_forward: 56,
  unique_canonical_commanders: 126,
  unique_member_decks: 61,
  distinct_original_alias_pairs: 204,
};

const expectedHeaders = {
  "players.csv": ["player_id", "name", "type", "moxfield_url"],
  "commander_registry.csv": ["commander_id", "canonical_name", "appearances_all_games", "appearances_member_only", "player_count_distinct", "reviewed_occurrences"],
  "member_decks.csv": ["deck_id", "player_id", "player", "commander_id", "commander", "historical_appearances", "moxfield_deck_url"],
  "games.csv": ["game_id", "source_game_key", "date", "date_origin", "pod_size", "member_count", "winner", "winner_seat", "result", "notes", "source_sheet_row", "analytics_eligible", "win_stats_eligible", "official_4p_win_stats_eligible"],
  "game_participants.csv": ["game_id", "source_game_key", "seat", "player_id", "display_player", "is_member", "original_player_name", "source_guest_name", "commander_id", "commander", "original_commander", "commander_review_id", "normalization_method", "source_card_title_from_review", "original_color", "is_winner", "source_sheet_row", "deck_id"],
  "commander_aliases.csv": ["owner_in_source", "source_name_variants", "player_type", "raw_commander", "canonical_commander", "commander_id", "review_id", "normalization_method", "owner_confirmed_exact_input", "appearances", "example_game"],
  "game_log_readable.csv": ["Game ID", "Date", "Date origin", "Pod", "Seat 1 Player", "Seat 1 Commander", "Seat 2 Player", "Seat 2 Commander", "Seat 3 Player", "Seat 3 Commander", "Seat 4 Player", "Seat 4 Commander", "Seat 5 Player", "Seat 5 Commander", "Seat 6 Player", "Seat 6 Commander", "Winner", "Winner seat", "Result", "Notes", "Member count", "Analytics eligible", "Win stats eligible", "Official 4P win stats", "Source", "Source game key"],
  "audit_exceptions.csv": ["game_id", "date", "source", "member_count", "result", "reason_excluded_win_stats", "notes"],
};

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

async function readRows(name) {
  const text = await readFile(resolve(dataDir, name), "utf8");
  const rows = parseCsv(text, name);
  const expected = expectedHeaders[name];
  const headers = rows.length ? Object.keys(rows[0]) : [];
  if (JSON.stringify(headers) !== JSON.stringify(expected)) {
    throw new Error(`${name}: CSV headers do not match the approved contract.`);
  }
  return rows;
}

function uniqueMap(rows, key, label) {
  const map = new Map();
  for (const row of rows) {
    const value = row[key];
    requireCondition(Boolean(value), `${label}: empty ${key}.`);
    requireCondition(!map.has(value), `${label}: duplicate ${key} ${value}.`);
    map.set(value, row);
  }
  return map;
}

function parseBoolean(value, label) {
  if (value === "1") return true;
  if (value === "0") return false;
  throw new Error(`${label}: expected 0 or 1.`);
}

function parseResult(value, gameId) {
  const map = {
    "Single winner": "single_winner",
    Draw: "draw",
    "Shared winner": "shared_winner",
    "Winner missing": "winner_missing",
  };
  const result = map[value];
  requireCondition(Boolean(result), `Unknown result category for ${gameId}.`);
  return result;
}

function validateDate(value, gameId) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`Invalid ISO date for ${gameId}.`);
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) throw new Error(`Invalid calendar date for ${gameId}.`);
}

async function main() {
  const [players, commanders, decks, games, participants, aliases, readable, exceptions] = await Promise.all([
    readRows("players.csv"), readRows("commander_registry.csv"), readRows("member_decks.csv"),
    readRows("games.csv"), readRows("game_participants.csv"), readRows("commander_aliases.csv"),
    readRows("game_log_readable.csv"), readRows("audit_exceptions.csv"),
  ]);
  const summary = JSON.parse(await readFile(resolve(dataDir, "validation_summary.json"), "utf8"));

  const playerMap = uniqueMap(players, "player_id", "players.csv");
  const commanderMap = uniqueMap(commanders, "commander_id", "commander_registry.csv");
  const deckMap = uniqueMap(decks, "deck_id", "member_decks.csv");
  const gameMap = uniqueMap(games, "game_id", "games.csv");
  const sourceGameKeys = new Set();
  const expectedMemberKeys = new Set(["nelson", "will", "manfred", "josh", "sam", "keenan"]);
  requireCondition(JSON.stringify([...playerMap.keys()].sort()) === JSON.stringify([...expectedMemberKeys].sort()), "Approved player-key roster mismatch.");
  requireCondition(players.every((player) => player.type.toLowerCase() === "member"), "Only approved member rows may be imported as players.");

  for (const game of games) {
    requireCondition(Boolean(game.source_game_key), `Missing source game key for ${game.game_id}.`);
    requireCondition(!sourceGameKeys.has(game.source_game_key), `Duplicate source game key for ${game.game_id}.`);
    sourceGameKeys.add(game.source_game_key);
    validateDate(game.date, game.game_id);
    requireCondition(["Explicit", "Carried forward"].includes(game.date_origin), `Invalid date origin for ${game.game_id}.`);
  }

  const groupedSeats = new Map([...gameMap.keys()].map((id) => [id, []]));
  const seatKeys = new Set();
  let guestSeats = 0;
  for (const row of participants) {
    requireCondition(gameMap.has(row.game_id), `Orphan participant game ${row.game_id}.`);
    const game = gameMap.get(row.game_id);
    requireCondition(row.source_game_key === game.source_game_key, `Participant source key mismatch for ${row.game_id}.`);
    requireCondition(commanderMap.has(row.commander_id), `Unknown commander key in ${row.game_id}.`);
    const seat = Number(row.seat);
    requireCondition(Number.isInteger(seat) && seat >= 1 && seat <= Number(game.pod_size), `Invalid seat number in ${row.game_id}.`);
    const seatKey = `${row.game_id}:${seat}`;
    requireCondition(!seatKeys.has(seatKey), `Duplicate game seat ${seatKey}.`);
    seatKeys.add(seatKey);
    const isMember = parseBoolean(row.is_member, `is_member ${row.game_id}:${seat}`);
    const isWinner = parseBoolean(row.is_winner, `is_winner ${row.game_id}:${seat}`);
    if (isMember) {
      requireCondition(playerMap.has(row.player_id), `Unknown member key in ${row.game_id}:${seat}.`);
      requireCondition(deckMap.has(row.deck_id), `Unknown member deck in ${row.game_id}:${seat}.`);
      const deck = deckMap.get(row.deck_id);
      requireCondition(deck.player_id === row.player_id, `Deck owner mismatch in ${row.game_id}:${seat}.`);
      requireCondition(deck.commander_id === row.commander_id, `Deck commander mismatch in ${row.game_id}:${seat}.`);
      requireCondition(row.display_player !== "Guest", `Member label is sanitized incorrectly in ${row.game_id}:${seat}.`);
    } else {
      guestSeats += 1;
      requireCondition(!row.player_id && !row.deck_id, `Guest seat has a member or deck ID in ${row.game_id}:${seat}.`);
      requireCondition(row.display_player === "Guest", `Guest public label must be Guest in ${row.game_id}:${seat}.`);
      requireCondition(Boolean(row.source_guest_name || row.original_player_name), `Guest provenance is missing in ${row.game_id}:${seat}.`);
    }
    groupedSeats.get(row.game_id).push({
      gameId: row.game_id,
      sourceGameKey: row.source_game_key,
      seat,
      playerId: isMember ? row.player_id : null,
      deckId: isMember ? row.deck_id : null,
      commanderId: row.commander_id,
      displayPlayer: isMember ? row.display_player : "Guest",
      isWinner,
    });
  }

  const importedGames = games.map((row) => {
    const game = {
      gameId: row.game_id,
      sourceGameKey: row.source_game_key,
      playedOn: row.date,
      dateOrigin: row.date_origin,
      podSize: Number(row.pod_size),
      memberCount: Number(row.member_count),
      result: parseResult(row.result, row.game_id),
      winnerSeat: row.winner_seat ? Number(row.winner_seat) : null,
      analyticsEligible: parseBoolean(row.analytics_eligible, `analytics_eligible ${row.game_id}`),
      winStatsEligible: parseBoolean(row.win_stats_eligible, `win_stats_eligible ${row.game_id}`),
      officialFourPlayerWinStatsEligible: parseBoolean(row.official_4p_win_stats_eligible, `official_4p_win_stats_eligible ${row.game_id}`),
    };
    const seats = groupedSeats.get(row.game_id);
    const errors = validateHistoricalGame(game, seats);
    requireCondition(errors.length === 0, errors.join(" "));
    return { row, game, seats };
  });

  for (const deck of decks) {
    requireCondition(playerMap.has(deck.player_id), `Unknown deck owner for ${deck.deck_id}.`);
    requireCondition(commanderMap.has(deck.commander_id), `Unknown deck commander for ${deck.deck_id}.`);
  }
  for (const alias of aliases) requireCondition(commanderMap.has(alias.commander_id), "Commander alias references an unknown canonical ID.");
  for (const exception of exceptions) requireCondition(gameMap.has(exception.game_id), `Exception references unknown game ${exception.game_id}.`);
  requireCondition(readable.length === games.length, "Readable game-log row count mismatch.");
  const exceptionMap = uniqueMap(exceptions, "game_id", "audit_exceptions.csv");
  requireCondition(exceptions.length === 30, "Expected 30 reference exclusions (27 under-threshold games plus 3 exceptional outcomes)." );
  const specialIds = ["4P-0046", "4P-0067", "4P-0106"];
  requireCondition(specialIds.every((id) => exceptionMap.has(id)), "Historical special-result IDs do not match the approved contract.");
  for (const exception of exceptions) requireCondition(gameMap.get(exception.game_id).result === exception.result, `Exception result mismatch for ${exception.game_id}.`);

  const guestWinningEligibleGames = [];
  const totals = {
    historical_games: games.length,
    seats_logged: participants.length,
    member_players: players.length,
    guest_seat_appearances: guestSeats,
    games_with_2plus_members: 0,
    games_with_2plus_members_and_single_winner: 0,
    official_four_player_single_winner_games: 0,
    excluded_less_than_two_members: 0,
    games_draw_or_shared_or_missing_winner: 0,
    date_carried_forward: games.filter((row) => row.date_origin === "Carried forward").length,
    unique_canonical_commanders: commanders.length,
    unique_member_decks: decks.length,
    distinct_original_alias_pairs: aliases.length,
  };
  for (const { game, seats } of importedGames) {
    const eligibility = getEligibility(game, seats);
    if (eligibility.participationEligible) totals.games_with_2plus_members += 1;
    else totals.excluded_less_than_two_members += 1;
    if (eligibility.winStatsEligible) totals.games_with_2plus_members_and_single_winner += 1;
    if (eligibility.officialFourPlayerWinStatsEligible) totals.official_four_player_single_winner_games += 1;
    if (game.result !== "single_winner") totals.games_draw_or_shared_or_missing_winner += 1;
    if (eligibility.winStatsEligible && seats.some((seat) => seat.seat === game.winnerSeat && seat.playerId === null)) guestWinningEligibleGames.push({ gameId: game.gameId, seat: game.winnerSeat });
  }
  for (const [key, value] of Object.entries(expected)) {
    requireCondition(totals[key] === value, `${key}: got ${totals[key]}, expected ${value}.`);
    requireCondition(summary[key] === value, `Snapshot summary disagrees for ${key}.`);
  }
  const podCounts = new Map();
  for (const game of games) podCounts.set(Number(game.pod_size), (podCounts.get(Number(game.pod_size)) ?? 0) + 1);
  requireCondition(JSON.stringify([...podCounts.entries()].sort((a, b) => a[0] - b[0])) === JSON.stringify([[3, 9], [4, 123], [5, 8], [6, 1]]), "Pod-size totals mismatch.");
  requireCondition(guestWinningEligibleGames.length > 0, "Expected eligible single-winner games won by a guest seat.");

  console.log("PASS: read-only historical import dry run");
  console.log("Reconciliation:");
  for (const [key, value] of Object.entries(totals)) console.log(`  ${key}: ${value}`);
  console.log("  pod_sizes: 3P=9, 4P=123, 5P=8, 6P=1");
  console.log(`  eligible_guest_winner_games: ${guestWinningEligibleGames.length}`);
  console.log("Import plan (not executed): players 6 → commanders 126 → member decks 61 → games 141 → seats 565 → private alias/provenance records 204.");

  const samples = [importedGames[0], importedGames[Math.floor(importedGames.length / 2)], importedGames.at(-1)];
  console.log("Safe game samples (member/Guest labels only; original guest names omitted):");
  for (const { game, seats } of samples) {
    const seatLabels = [...seats].sort((a, b) => a.seat - b.seat).map((seat) => `${seat.seat}:${seat.playerId === null ? "Guest" : "Member"}`).join(", ");
    console.log(`  ${game.gameId} · ${game.playedOn} · ${game.podSize} seats · ${game.result} · [${seatLabels}]`);
  }
  console.log("Exceptional results:");
  for (const { game } of importedGames.filter(({ game }) => game.result !== "single_winner")) console.log(`  ${game.gameId} · ${game.result} · no winning seat`);
  console.log("Eligible guest-winning examples:");
  for (const sample of guestWinningEligibleGames.slice(0, 3)) console.log(`  ${sample.gameId} · winning Guest seat ${sample.seat}`);
  console.log("Carried-forward date examples:");
  for (const { game } of importedGames.filter(({ game }) => game.dateOrigin === "Carried forward").slice(0, 3)) console.log(`  ${game.gameId} · ${game.playedOn}`);
  console.log("No network requests or database writes were performed.");
  console.log("Private source guest names were not printed.");
}

main().catch((error) => {
  console.error(`Historical dry run failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
