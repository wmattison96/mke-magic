import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import pg from "pg";
import { parseCsv } from "../lib/historical/csv.mts";
import { getEligibility, validateHistoricalGame } from "../lib/historical/model.ts";
import { containsGuestName, redactGuestNames } from "../lib/historical/privacy.mts";

const { Client } = pg;
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = resolve(root, "data/historical");
const apply = process.argv.includes("--apply");
const sourceName = "approved-historical-csv-v1.1";
const sourceFiles = [
  "players.csv",
  "commander_registry.csv",
  "member_decks.csv",
  "games.csv",
  "game_participants.csv",
  "commander_aliases.csv",
  "game_log_readable.csv",
  "audit_exceptions.csv",
  "validation_summary.json",
];
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
const resultMap = new Map([
  ["Single winner", "single_winner"],
  ["Draw", "draw"],
  ["Shared winner", "shared_winner"],
  ["Winner missing", "winner_missing"],
]);

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function bool(value, label) {
  if (value === "1") return true;
  if (value === "0") return false;
  throw new Error(label + " must be 0 or 1.");
}

function isoDate(value) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function stableJson(value) {
  if (Array.isArray(value)) return "[" + value.map(stableJson).join(",") + "]";
  if (value && typeof value === "object") {
    return "{" + Object.keys(value).sort().map((key) => JSON.stringify(key) + ":" + stableJson(value[key])).join(",") + "}";
  }
  return JSON.stringify(value);
}

function parseRows(name, text) {
  return parseCsv(text, name);
}

async function readSnapshot() {
  const contents = new Map();
  const hash = createHash("sha256");
  for (const name of sourceFiles) {
    const bytes = await readFile(resolve(dataDir, name));
    contents.set(name, bytes.toString("utf8"));
    hash.update(name);
    hash.update("\0");
    hash.update(bytes);
    hash.update("\0");
  }

  try {
    execFileSync(process.execPath, ["--experimental-strip-types", "scripts/historical-check.mjs"], {
      cwd: root,
      stdio: "pipe",
      encoding: "utf8",
    });
  } catch {
    throw new Error("The historical contract check failed; no database work was attempted.");
  }

  const rows = new Map();
  for (const name of sourceFiles.filter((file) => file.endsWith(".csv"))) {
    rows.set(name, parseRows(name, contents.get(name)));
  }
  const summary = JSON.parse(contents.get("validation_summary.json"));
  return { rows, summary, snapshotHash: hash.digest("hex") };
}

function buildPlan(snapshot) {
  const players = snapshot.rows.get("players.csv");
  const commanders = snapshot.rows.get("commander_registry.csv");
  const decks = snapshot.rows.get("member_decks.csv");
  const games = snapshot.rows.get("games.csv");
  const participants = snapshot.rows.get("game_participants.csv");
  const aliases = snapshot.rows.get("commander_aliases.csv");
  const exceptions = snapshot.rows.get("audit_exceptions.csv");
  const exceptionByGame = new Map(exceptions.map((row) => [row.game_id, row]));
  const playerByKey = new Map(players.map((row) => [row.player_id, row]));
  const commanderByKey = new Map(commanders.map((row) => [row.commander_id, row]));
  const deckByKey = new Map(decks.map((row) => [row.deck_id, row]));
  const gameById = new Map(games.map((row) => [row.game_id, row]));
  requireCondition(playerByKey.size === players.length, "Duplicate historical player key.");
  requireCondition(commanderByKey.size === commanders.length, "Duplicate historical commander key.");
  requireCondition(deckByKey.size === decks.length, "Duplicate historical deck key.");
  requireCondition(gameById.size === games.length, "Duplicate historical game ID.");

  const grouped = new Map(games.map((row) => [row.game_id, []]));
  const rawParticipantsByGame = new Map(games.map((row) => [row.game_id, []]));
  for (const row of participants) {
    const game = gameById.get(row.game_id);
    requireCondition(Boolean(game), "Participant references an unknown historical game.");
    requireCondition(commanderByKey.has(row.commander_id), "Participant references an unknown commander.");
    const seat = Number(row.seat);
    requireCondition(Number.isInteger(seat) && seat >= 1 && seat <= Number(game.pod_size), "Participant seat is outside the pod.");
    const isMember = bool(row.is_member, "is_member");
    const isWinner = bool(row.is_winner, "is_winner");
    rawParticipantsByGame.get(row.game_id).push(row);
    if (isMember) {
      requireCondition(playerByKey.has(row.player_id), "Member seat references an unknown player.");
      const deck = deckByKey.get(row.deck_id);
      requireCondition(Boolean(deck), "Member seat references an unknown deck.");
      requireCondition(deck.player_id === row.player_id && deck.commander_id === row.commander_id, "Member seat deck ownership or commander does not match.");
      requireCondition(row.display_player !== "Guest", "Member label unexpectedly uses the guest label.");
    } else {
      requireCondition(!row.player_id && !row.deck_id && row.display_player === "Guest", "Guest seat must not have a member/deck ID or public name.");
      requireCondition(Boolean(row.source_guest_name || row.original_player_name), "Guest source provenance is incomplete.");
    }
    grouped.get(row.game_id).push({
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

  const normalizedGames = games.map((row) => {
    const result = resultMap.get(row.result);
    requireCondition(Boolean(result), "Unknown historical result category.");
    const game = {
      gameId: row.game_id,
      sourceGameKey: row.source_game_key,
      playedOn: row.date,
      dateOrigin: row.date_origin,
      podSize: Number(row.pod_size),
      memberCount: Number(row.member_count),
      result,
      winnerSeat: row.winner_seat ? Number(row.winner_seat) : null,
      analyticsEligible: bool(row.analytics_eligible, "analytics_eligible"),
      winStatsEligible: bool(row.win_stats_eligible, "win_stats_eligible"),
      officialFourPlayerWinStatsEligible: bool(row.official_4p_win_stats_eligible, "official_4p_win_stats_eligible"),
    };
    const seats = grouped.get(row.game_id);
    const errors = validateHistoricalGame(game, seats);
    requireCondition(errors.length === 0, errors.join(" "));
    requireCondition(row.source_game_key === seats[0]?.sourceGameKey, "Game and participant source keys do not match.");
    requireCondition(row.source_game_key.length > 0, "Missing source game key.");
    return { row, game, seats };
  });

  for (const deck of decks) {
    requireCondition(playerByKey.has(deck.player_id) && commanderByKey.has(deck.commander_id), "Deck references an unknown player or commander.");
  }
  for (const alias of aliases) requireCondition(commanderByKey.has(alias.commander_id), "Alias references an unknown commander.");
  for (const exception of exceptions) requireCondition(gameById.has(exception.game_id), "Exception references an unknown game.");

  const guestNames = [...new Set(participants
    .filter((row) => row.is_member === "0")
    .flatMap((row) => [row.source_guest_name, row.original_player_name])
    .filter((name) => Boolean(name)))];
  const totals = {
    historical_games: games.length,
    seats_logged: participants.length,
    member_players: players.length,
    guest_seat_appearances: participants.filter((row) => row.is_member === "0").length,
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
  let eligibleGuestWinners = 0;
  let guestWinnerSeats = 0;
  for (const { game, seats } of normalizedGames) {
    const eligibility = getEligibility(game, seats);
    if (eligibility.participationEligible) totals.games_with_2plus_members += 1;
    else totals.excluded_less_than_two_members += 1;
    if (eligibility.winStatsEligible) totals.games_with_2plus_members_and_single_winner += 1;
    if (eligibility.officialFourPlayerWinStatsEligible) totals.official_four_player_single_winner_games += 1;
    if (game.result !== "single_winner") totals.games_draw_or_shared_or_missing_winner += 1;
    if (seats.some((seat) => seat.seat === game.winnerSeat && seat.playerId === null)) {
      guestWinnerSeats += 1;
      if (eligibility.winStatsEligible) eligibleGuestWinners += 1;
    }
  }
  for (const [key, value] of Object.entries(expected)) {
    requireCondition(totals[key] === value && snapshot.summary[key] === value, "Historical reconciliation mismatch for " + key + ".");
  }
  requireCondition(eligibleGuestWinners > 0, "The snapshot must preserve eligible guest-winning games.");
  requireCondition(exceptions.length === 30, "Expected all 30 audit exclusion references.");
  requireCondition(["4P-0046", "4P-0067", "4P-0106"].every((id) => {
    const entry = exceptionByGame.get(id);
    return entry && ["Draw", "Shared winner", "Winner missing"].includes(entry.result);
  }), "Historical exceptional outcomes differ from the approved contract.");

  const numbersByGameKey = new Map();
  const dailySequence = new Map();
  for (const { row } of [...normalizedGames].sort((a, b) => {
    const dateOrder = a.row.date.localeCompare(b.row.date);
    return dateOrder || a.row.source_game_key.localeCompare(b.row.source_game_key);
  })) {
    const next = (dailySequence.get(row.date) ?? 0) + 1;
    dailySequence.set(row.date, next);
    numbersByGameKey.set(row.source_game_key, next);
  }
  return {
    players, commanders, decks, aliases, exceptions, normalizedGames, grouped, rawParticipantsByGame, guestNames,
    totals, eligibleGuestWinners, guestWinnerSeats, numbersByGameKey, snapshotHash: snapshot.snapshotHash,
  };
}

function printPlan(plan) {
  console.log("Historical snapshot preflight passed. No names from private guest columns were printed.");
  console.log("Snapshot SHA-256: " + plan.snapshotHash);
  console.log("Expected import order: 6 players → 126 commanders → 61 decks → 141 games → 565 seats → 204 private aliases and 141 private game provenance rows.");
  for (const [key, value] of Object.entries(plan.totals)) console.log("  " + key + ": " + value);
  console.log("  eligible_guest_winner_games: " + plan.eligibleGuestWinners);
  console.log("  guest_winner_seats_all_games: " + plan.guestWinnerSeats);
  console.log("  daily_numbering: played_on ascending, then stable source_game_key ascending");
  console.log(apply ? "Apply requested; checking project access before writing." : "Dry run only. Re-run with --apply and SUPABASE_DB_URL to import.");
}

function publicRestUrl(projectUrl, relation, query) {
  const rootUrl = projectUrl.replace(/\/+$/, "");
  return rootUrl + "/rest/v1/" + relation + "?" + new URLSearchParams(query).toString();
}

async function fetchPublicRows(projectUrl, key, relation, query) {
  const response = await fetch(publicRestUrl(projectUrl, relation, query), {
    headers: { apikey: key, Authorization: "Bearer " + key, Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Safe public view " + relation + " is unavailable (HTTP " + response.status + ").");
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error("Safe public view " + relation + " returned an invalid response.");
  return rows;
}

function verifyProjectTarget(dbUrl, projectUrl) {
  let projectRef;
  let db;
  try {
    projectRef = new URL(projectUrl).hostname.split(".")[0];
    db = new URL(dbUrl);
  } catch {
    throw new Error("Supabase URL configuration is not a valid URL.");
  }
  const dbUser = decodeURIComponent(db.username);
  const matchesHost = db.hostname.includes(projectRef);
  const matchesPoolerUser = dbUser.endsWith("." + projectRef);
  requireCondition(matchesHost || matchesPoolerUser, "SUPABASE_DB_URL does not identify the same project as the public Supabase URL.");
}

async function verifyPublicViews(plan) {
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  requireCondition(projectUrl && key, "Public Supabase URL and publishable key are required for public-view verification.");
  const games = await fetchPublicRows(projectUrl, key, "readable_games", {
    select: "id,played_on,game_number_on_date,pod_size,member_count,result_type,winning_seat,source,date_origin,public_notes",
    source: "eq.spreadsheet",
    limit: "1000",
  });
  const gameIds = games.map((row) => row.id);
  requireCondition(games.length === expected.historical_games, "Public historical game view count mismatch.");
  requireCondition(gameIds.length === new Set(gameIds).size, "Public game view contains duplicate IDs.");
  const participants = await fetchPublicRows(projectUrl, key, "readable_game_participants", {
    select: "game_id,seat,participant_type,public_player_name,player_id,deck_id,commander_id,is_winner",
    game_id: "in.(" + gameIds.join(",") + ")",
    limit: "1000",
  });
  requireCondition(participants.length === expected.seats_logged, "Public participant view count mismatch.");
  requireCondition(participants.every((row) => row.participant_type !== "guest" || row.public_player_name === "Guest"), "Public guest label is not sanitized.");
  requireCondition(participants.every((row) => !("source_guest_name" in row) && !("original_player_name" in row)), "Public participant response exposes a private guest column.");
  for (const row of games) {
    if (row.public_notes) requireCondition(!containsGuestName(row.public_notes, plan.guestNames), "A historical public note contains a private guest name.");
  }
  const publicGuestWinners = participants.filter((row) => row.participant_type === "guest" && row.is_winner).length;
  requireCondition(publicGuestWinners === plan.guestWinnerSeats, "Public guest-winner seat count differs from imported source.");
  console.log("Public API verification passed: 141 historical games, 565 seats, sanitized guest labels, and " + publicGuestWinners + " guest-winning seats.");
}

async function runDatabaseImport(plan) {
  const databaseUrl = process.env.SUPABASE_DB_URL;
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  requireCondition(databaseUrl, "SUPABASE_DB_URL is required only for the explicitly requested --apply run.");
  requireCondition(projectUrl, "NEXT_PUBLIC_SUPABASE_URL is required.");
  verifyProjectTarget(databaseUrl, projectUrl);
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  requireCondition(publicKey, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required.");
  await fetchPublicRows(projectUrl, publicKey, "readable_games", { select: "id", limit: "1" });
  await fetchPublicRows(projectUrl, publicKey, "readable_game_participants", { select: "game_id", limit: "1" });

  const client = new Client({ connectionString: databaseUrl });
  let insertedFirstSnapshot = false;
  try {
    await client.connect();
    await client.query("begin");
    await client.query("select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended($1, 0))", [sourceName]);

    const privilege = await client.query(
      "select (role.rolsuper or role.rolbypassrls) as can_import from pg_catalog.pg_roles as role where role.rolname = current_user",
    );
    requireCondition(privilege.rows[0]?.can_import === true, "Database connection must use a privileged migration/import role.");
    const tables = await client.query(
      "select to_regclass('public.players') is not null and to_regclass('public.commanders') is not null and to_regclass('public.member_decks') is not null and to_regclass('public.games') is not null and to_regclass('public.game_participants') is not null and to_regclass('private.historical_game_provenance') is not null and to_regclass('private.commander_alias_provenance') is not null as ready",
    );
    requireCondition(tables.rows[0]?.ready === true, "Prompt 1 and Prompt 2 migrations must be applied before import.");
    const privateAccess = await client.query(
      "select has_schema_privilege('anon', 'private', 'USAGE') as anon_schema, has_table_privilege('anon', 'private.historical_game_provenance', 'SELECT') as anon_provenance, has_table_privilege('authenticated', 'private.historical_game_provenance', 'SELECT') as member_provenance",
    );
    requireCondition(!privateAccess.rows[0].anon_schema && !privateAccess.rows[0].anon_provenance && !privateAccess.rows[0].member_provenance, "Private provenance permissions are too broad.");

    const batches = await client.query("select id, snapshot_sha256 from private.import_batches where source_name = $1", [sourceName]);
    requireCondition(batches.rows.every((row) => row.snapshot_sha256 === plan.snapshotHash), "A different historical snapshot is already imported; this script will not overwrite or merge changed source records.");
    const existingProvenance = await client.query(
      "select source_game_key, source_game_id from private.historical_game_provenance",
    );
    requireCondition(existingProvenance.rows.length === 0 || batches.rows.length > 0, "Historical provenance exists without the matching import-batch record.");
    const existingBatch = batches.rows.find((row) => row.snapshot_sha256 === plan.snapshotHash);
    insertedFirstSnapshot = !existingBatch;

    const batchInsert = await client.query(
      "insert into private.import_batches (source_name, snapshot_sha256, source_counts, imported_at) values ($1, $2, $3::jsonb, now()) on conflict (snapshot_sha256) do nothing returning id",
      [sourceName, plan.snapshotHash, JSON.stringify({ ...plan.totals, private_aliases: plan.aliases.length })],
    );
    const batch = batchInsert.rows[0] ?? (await client.query(
      "select id from private.import_batches where snapshot_sha256 = $1",
      [plan.snapshotHash],
    )).rows[0];
    requireCondition(Boolean(batch?.id), "Could not identify the import batch.");

    const playerIds = new Map();
    for (const row of plan.players) {
      const profileUrl = row.moxfield_url || null;
      await client.query(
        "insert into public.players (historical_player_key, display_name, moxfield_url) values ($1, $2, $3) on conflict do nothing",
        [row.player_id, row.name, profileUrl],
      );
      const found = (await client.query(
        "select id, display_name, moxfield_url from public.players where historical_player_key = $1",
        [row.player_id],
      )).rows[0];
      requireCondition(found && found.display_name === row.name && found.moxfield_url === profileUrl, "Existing player data conflicts with the approved snapshot.");
      playerIds.set(row.player_id, found.id);
    }

    const commanderIds = new Map();
    for (const row of plan.commanders) {
      await client.query(
        "insert into public.commanders (historical_commander_key, canonical_name) values ($1, $2) on conflict do nothing",
        [row.commander_id, row.canonical_name],
      );
      const found = (await client.query(
        "select id, canonical_name from public.commanders where historical_commander_key = $1",
        [row.commander_id],
      )).rows[0];
      requireCondition(found && typeof found.id === "string" && found.canonical_name === row.canonical_name, "Existing commander data conflicts with the approved canonical name or has no database ID.");
      commanderIds.set(row.commander_id, found.id);
    }
    requireCondition(commanderIds.size === expected.unique_canonical_commanders, "Database commander ID map is incomplete.");

    const deckIds = new Map();
    for (const row of plan.decks) {
      const ownerId = playerIds.get(row.player_id);
      const commanderId = commanderIds.get(row.commander_id);
      const deckUrl = row.moxfield_deck_url || null;
      await client.query(
        "insert into public.member_decks (historical_deck_key, owner_player_id, commander_id, display_name, moxfield_url) values ($1, $2, $3, null, $4) on conflict do nothing",
        [row.deck_id, ownerId, commanderId, deckUrl],
      );
      const found = (await client.query(
        "select id, owner_player_id, commander_id, display_name, moxfield_url from public.member_decks where historical_deck_key = $1",
        [row.deck_id],
      )).rows[0];
      requireCondition(found && found.owner_player_id === ownerId && found.commander_id === commanderId && found.display_name === null && found.moxfield_url === deckUrl, "Existing deck data conflicts with the approved snapshot.");
      deckIds.set(row.deck_id, found.id);
    }

    const oldGameKeys = new Set(existingProvenance.rows.map((row) => row.source_game_key));
    const requestedGameKeys = new Set(plan.normalizedGames.map(({ game }) => game.sourceGameKey));
    requireCondition(oldGameKeys.size === 0 || (
      oldGameKeys.size === requestedGameKeys.size && [...requestedGameKeys].every((key) => oldGameKeys.has(key))
    ), "Existing historical game keys differ from this approved snapshot.");
    if (insertedFirstSnapshot) {
      const anyGames = await client.query("select count(*)::integer as count from public.games");
      requireCondition(anyGames.rows[0].count === 0, "Games already exist in this project; the importer will not renumber or overwrite them.");
    }

    const provenanceByKey = new Map();
    if (oldGameKeys.size > 0) {
      const rows = await client.query(
        "select provenance.source_game_key, provenance.source_game_id, provenance.raw_game_row, provenance.raw_participant_rows, game.id, game.played_on, game.game_number_on_date, game.pod_size, game.member_count, game.result_type, game.winning_seat, game.source, game.date_origin, game.public_notes from private.historical_game_provenance as provenance join public.games as game on game.id = provenance.game_id",
      );
      for (const row of rows.rows) provenanceByKey.set(row.source_game_key, row);
    }

    for (const { row, game } of plan.normalizedGames) {
      const prior = provenanceByKey.get(game.sourceGameKey);
      const publicNotes = redactGuestNames(row.notes || null, plan.guestNames);
      requireCondition(!publicNotes || !containsGuestName(publicNotes, plan.guestNames), "A private guest name remains in a public note after redaction.");
      const rawSeats = plan.rawParticipantsByGame.get(row.game_id);
      if (prior) {
        requireCondition(prior.source_game_id === row.game_id && stableJson(prior.raw_game_row) === stableJson(row) && stableJson(prior.raw_participant_rows) === stableJson(rawSeats), "Stored private historical source rows differ; refusing to overwrite.");
        requireCondition(isoDate(prior.played_on) === game.playedOn && Number(prior.game_number_on_date) === plan.numbersByGameKey.get(game.sourceGameKey) && Number(prior.pod_size) === game.podSize && Number(prior.member_count) === game.memberCount && prior.result_type === game.result && prior.winning_seat === game.winnerSeat && prior.source === "spreadsheet" && prior.date_origin === game.dateOrigin.toLowerCase().replace(" ", "_") && prior.public_notes === publicNotes, "Existing historical game was edited or conflicts with the source snapshot.");
        continue;
      }

      const dailyNumber = plan.numbersByGameKey.get(game.sourceGameKey);
      const inserted = await client.query(
        "insert into public.games (played_on, game_number_on_date, pod_size, member_count, result_type, winning_seat, source, date_origin, public_notes) values ($1::date, $2, $3, $4, $5, $6, 'spreadsheet', $7, $8) returning id",
        [game.playedOn, dailyNumber, game.podSize, game.memberCount, game.result, game.winnerSeat, game.dateOrigin.toLowerCase().replace(" ", "_"), publicNotes],
      );
      const gameId = inserted.rows[0].id;
      for (const sourceSeat of rawSeats) {
        const participantCommanderId = commanderIds.get(sourceSeat.commander_id);
        requireCondition(
          typeof participantCommanderId === "string",
          "Missing database commander mapping for historical game " + row.game_id + " seat " + sourceSeat.seat + ".",
        );
        await client.query(
          "insert into public.game_participants (game_id, seat, participant_type, player_id, deck_id, commander_id) values ($1, $2, $3, $4, $5, $6)",
          [
            gameId,
            Number(sourceSeat.seat),
            sourceSeat.is_member === "1" ? "member" : "guest",
            sourceSeat.is_member === "1" ? playerIds.get(sourceSeat.player_id) : null,
            sourceSeat.is_member === "1" ? deckIds.get(sourceSeat.deck_id) : null,
            participantCommanderId,
          ],
        );
      }

      await client.query(
        "insert into private.historical_game_provenance (game_id, import_batch_id, source_game_key, source_game_id, source_sheet_row, original_winner_description, exception_reference, raw_game_row, raw_participant_rows, original_guest_names, original_commander_labels) values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb)",
        [
          gameId, batch.id, game.sourceGameKey, row.game_id, row.source_sheet_row || null, row.winner || null,
          JSON.stringify(plan.exceptions.find((entry) => entry.game_id === row.game_id) ?? {}),
          JSON.stringify(row),
          JSON.stringify(rawSeats),
          JSON.stringify(rawSeats.filter((entry) => entry.is_member === "0").map((entry) => ({
            original_player_name: entry.original_player_name,
            source_guest_name: entry.source_guest_name,
          }))),
          JSON.stringify(rawSeats.map((entry) => entry.original_commander)),
        ],
      );
    }

    for (const row of plan.aliases) {
      const sourceAlias = row;
      const sourceAliasHash = createHash("sha256").update(stableJson(sourceAlias)).digest("hex");
      await client.query(
        "insert into private.commander_alias_provenance (import_batch_id, commander_id, source_alias_hash, source_alias, reviewed_canonical_name, review_id) values ($1, $2, $3, $4::jsonb, $5, $6) on conflict (source_alias_hash) do nothing",
        [batch.id, commanderIds.get(row.commander_id), sourceAliasHash, JSON.stringify(sourceAlias), row.canonical_commander, row.review_id || null],
      );
      const saved = (await client.query(
        "select commander_id, source_alias, reviewed_canonical_name, review_id from private.commander_alias_provenance where source_alias_hash = $1",
        [sourceAliasHash],
      )).rows[0];
      requireCondition(saved && saved.commander_id === commanderIds.get(row.commander_id) && stableJson(saved.source_alias) === stableJson(sourceAlias) && saved.reviewed_canonical_name === row.canonical_commander && saved.review_id === (row.review_id || null), "Private commander alias provenance conflicts with the approved snapshot.");
    }

    await client.query(
      "update private.import_batches set imported_at = coalesce(imported_at, now()), source_counts = $2::jsonb where id = $1",
      [batch.id, JSON.stringify({ ...plan.totals, private_aliases: plan.aliases.length })],
    );

    const actualProvenance = await client.query(
      "select provenance.source_game_key, provenance.source_game_id, provenance.raw_game_row, provenance.raw_participant_rows, game.id, game.played_on, game.game_number_on_date, game.pod_size, game.member_count, game.result_type, game.winning_seat, game.source, game.date_origin, game.public_notes from private.historical_game_provenance as provenance join public.games as game on game.id = provenance.game_id where provenance.import_batch_id = $1 order by provenance.source_game_key",
      [batch.id],
    );
    requireCondition(actualProvenance.rows.length === expected.historical_games, "Database historical game count mismatch.");
    for (const saved of actualProvenance.rows) {
      const expectedGame = plan.normalizedGames.find(({ game }) => game.sourceGameKey === saved.source_game_key);
      requireCondition(Boolean(expectedGame), "Database contains an unexpected historical game key.");
      requireCondition(saved.source_game_id === expectedGame.row.game_id && stableJson(saved.raw_game_row) === stableJson(expectedGame.row), "Database private game source verification failed.");
      requireCondition(stableJson(saved.raw_participant_rows) === stableJson(plan.rawParticipantsByGame.get(expectedGame.row.game_id)), "Database private participant source verification failed.");
      const mismatches = [];
      if (isoDate(saved.played_on) !== expectedGame.game.playedOn) mismatches.push("played_on");
      if (Number(saved.game_number_on_date) !== plan.numbersByGameKey.get(expectedGame.game.sourceGameKey)) mismatches.push("game_number_on_date");
      if (Number(saved.pod_size) !== expectedGame.game.podSize) mismatches.push("pod_size");
      if (Number(saved.member_count) !== expectedGame.game.memberCount) mismatches.push("member_count");
      if (saved.result_type !== expectedGame.game.result) mismatches.push("result_type");
      if (saved.winning_seat !== expectedGame.game.winnerSeat) mismatches.push("winning_seat");
      if (saved.source !== "spreadsheet") mismatches.push("source");
      if (saved.date_origin !== expectedGame.game.dateOrigin.toLowerCase().replace(" ", "_")) mismatches.push("date_origin");
      requireCondition(mismatches.length === 0, "Database game " + expectedGame.row.game_id + " mismatches: " + mismatches.join(", ") + ".");
    }
    const privateAliasCount = await client.query("select count(*)::integer as count from private.commander_alias_provenance where import_batch_id = $1", [batch.id]);
    requireCondition(privateAliasCount.rows[0].count === expected.distinct_original_alias_pairs, "Database private alias provenance count mismatch.");

    const publicGames = await client.query(
      "select game.id, provenance.source_game_key, game.played_on, game.game_number_on_date, game.pod_size, game.member_count, game.result_type, game.winning_seat, game.source, game.date_origin, game.public_notes from private.historical_game_provenance as provenance join public.games as game on game.id = provenance.game_id where provenance.import_batch_id = $1",
      [batch.id],
    );
    const gameIds = publicGames.rows.map((row) => row.id);
    const savedSeats = await client.query(
      "select participant.game_id, participant.seat, participant.participant_type, participant.player_id, participant.deck_id, participant.commander_id, coalesce(game.winning_seat = participant.seat, false) as is_winner from public.game_participants as participant join public.games as game on game.id = participant.game_id where participant.game_id = any($1::uuid[]) order by participant.game_id, participant.seat",
      [gameIds],
    );
    requireCondition(savedSeats.rows.length === expected.seats_logged, "Database seat count mismatch.");
    let actualGuestSeats = 0;
    let actualGuestWinners = 0;
    const databaseSeatsByGameId = new Map();
    for (const seat of savedSeats.rows) {
      const publicGame = publicGames.rows.find((game) => game.id === seat.game_id);
      const sourceGame = plan.normalizedGames.find(({ game }) => game.sourceGameKey === publicGame?.source_game_key);
      const sourceSeat = sourceGame && plan.rawParticipantsByGame.get(sourceGame.row.game_id).find((candidate) => Number(candidate.seat) === Number(seat.seat));
      requireCondition(Boolean(sourceGame && sourceSeat), "Database contains an unexpected participant seat.");
      const expectedType = sourceSeat.is_member === "1" ? "member" : "guest";
      const expectedPlayerId = expectedType === "member" ? playerIds.get(sourceSeat.player_id) : null;
      const expectedDeckId = expectedType === "member" ? deckIds.get(sourceSeat.deck_id) : null;
      requireCondition(
        seat.participant_type === expectedType
        && seat.player_id === expectedPlayerId
        && seat.deck_id === expectedDeckId
        && seat.commander_id === commanderIds.get(sourceSeat.commander_id)
        && seat.is_winner === (sourceSeat.is_winner === "1"),
        "Database participant differs from its exact historical source seat.",
      );
      if (seat.participant_type === "guest") {
        actualGuestSeats += 1;
        if (seat.is_winner) actualGuestWinners += 1;
        requireCondition(seat.player_id === null && seat.deck_id === null, "A historical guest seat is attached to a member or deck.");
      }
      const key = databaseSeatsByGameId.get(seat.game_id) ?? [];
      key.push(seat);
      databaseSeatsByGameId.set(seat.game_id, key);
    }
    requireCondition(actualGuestSeats === expected.guest_seat_appearances && actualGuestWinners === plan.guestWinnerSeats, "Database guest-seat or guest-winner count mismatch.");

    const calculated = { ...expected };
    calculated.games_with_2plus_members = 0;
    calculated.games_with_2plus_members_and_single_winner = 0;
    calculated.official_four_player_single_winner_games = 0;
    calculated.excluded_less_than_two_members = 0;
    calculated.games_draw_or_shared_or_missing_winner = 0;
    for (const row of publicGames.rows) {
      const source = plan.normalizedGames.find((entry) => entry.game.sourceGameKey === row.source_game_key);
      const dbSeats = databaseSeatsByGameId.get(row.id) ?? [];
      const game = {
        ...source.game,
        memberCount: Number(row.member_count),
        podSize: Number(row.pod_size),
        result: row.result_type,
        winnerSeat: row.winning_seat,
      };
      const seats = dbSeats.map((seat) => ({
        gameId: source.game.gameId,
        sourceGameKey: source.game.sourceGameKey,
        seat: Number(seat.seat),
        playerId: seat.player_id,
        deckId: seat.deck_id,
        commanderId: seat.commander_id,
        displayPlayer: seat.participant_type === "guest" ? "Guest" : "Member",
        isWinner: seat.is_winner,
      }));
      const errors = validateHistoricalGame(game, seats);
      requireCondition(errors.length === 0, "Database game validation failed: " + errors.join(" "));
      const eligibility = getEligibility(game, seats);
      if (eligibility.participationEligible) calculated.games_with_2plus_members += 1;
      else calculated.excluded_less_than_two_members += 1;
      if (eligibility.winStatsEligible) calculated.games_with_2plus_members_and_single_winner += 1;
      if (eligibility.officialFourPlayerWinStatsEligible) calculated.official_four_player_single_winner_games += 1;
      if (game.result !== "single_winner") calculated.games_draw_or_shared_or_missing_winner += 1;
    }
    for (const key of Object.keys(expected)) {
      if (key.startsWith("games_") || key === "official_four_player_single_winner_games" || key === "excluded_less_than_two_members") {
        requireCondition(calculated[key] === expected[key], "Imported eligibility total mismatch for " + key + ".");
      }
    }

    await client.query("commit");
    console.log((insertedFirstSnapshot ? "Historical snapshot imported" : "Historical snapshot already present; verified idempotently") + " in one transaction.");
    console.log("Database reconciliation passed: 141 games, 565 seats, 6 members, 131 guest seats, 126 commanders, 61 decks, and 204 private alias rows.");
    console.log("Eligibility passed: 114 participation-eligible, 111 win-eligible, 97 official four-player; 27 below the member threshold and 3 exceptional results retained.");
    console.log("Private provenance preserves source rows, guest names, winner descriptions, notes, and all 30 audit exception references.");
  } catch (error) {
    try { await client.query("rollback"); } catch {}
    throw error;
  } finally {
    await client.end().catch(() => {});
  }

  await verifyPublicViews(plan);
}

async function main() {
  const snapshot = await readSnapshot();
  const plan = buildPlan(snapshot);
  printPlan(plan);
  if (!apply) return;
  await runDatabaseImport(plan);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown import error.";
  console.error("Historical import stopped: " + message);
  process.exitCode = 1;
});
