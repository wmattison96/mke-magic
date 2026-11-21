import { randomUUID } from "node:crypto";
import pg from "pg";
import { getEligibility, validateHistoricalGame } from "../lib/historical/model.ts";
import { containsGuestName } from "../lib/historical/privacy.mts";

const { Client } = pg;
const expectedProjectRef = "tuiripvkrvlfvkgunohu";
const sourceName = "approved-historical-csv-v1.1";
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
  all_guest_winner_seats: 28,
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isoDate(value) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function restUrl(projectUrl, view, query) {
  return projectUrl.replace(/\/+$/, "") + "/rest/v1/" + view + "?" + new URLSearchParams(query).toString();
}

async function safePublicRows(projectUrl, key, view, query) {
  const response = await fetch(restUrl(projectUrl, view, query), {
    headers: { apikey: key, Authorization: "Bearer " + key, Accept: "application/json" },
    cache: "no-store",
  });
  assert(response.ok, "Safe public view " + view + " failed with HTTP " + response.status + ".");
  const rows = await response.json();
  assert(Array.isArray(rows), "Safe public view " + view + " returned an invalid response.");
  return rows;
}

async function expectDenied(client, sql) {
  await client.query("savepoint authorization_probe");
  let code = null;
  try {
    await client.query(sql);
  } catch (error) {
    code = error?.code ?? null;
  }
  await client.query("rollback to savepoint authorization_probe");
  await client.query("release savepoint authorization_probe");
  return code === "42501";
}

function validateCounts(actual) {
  for (const [key, value] of Object.entries(expected)) {
    assert(actual[key] === value, "Hosted reconciliation failed for " + key + ".");
  }
}

async function main() {
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const connectionString = process.env.SUPABASE_DB_URL;
  assert(projectUrl && publicKey && connectionString, "Set Supabase values in the ignored .env.local.");
  const projectRef = new URL(projectUrl).hostname.split(".")[0];
  const connection = new URL(connectionString);
  const databaseUser = decodeURIComponent(connection.username);
  assert(projectRef === expectedProjectRef, "The public URL is not the expected Supabase project.");
  assert(connection.hostname.includes(expectedProjectRef) || databaseUser.endsWith("." + expectedProjectRef), "The database URI does not identify the expected Supabase project.");

  const client = new Client({ connectionString, connectionTimeoutMillis: 12000 });
  let counts;
  let securitySummary;
  let privateGuestNames;
  try {
    await client.connect();
    const identity = (await client.query(
      "select current_user, session_user, current_database(), current_setting('server_version') as server_version, (select rolsuper or rolbypassrls from pg_catalog.pg_roles where rolname = current_user) as privileged",
    )).rows[0];
    assert(identity.privileged === true, "The database URI must connect with a migration/import role.");
    const roleMatches = identity.current_user === "postgres"
      || identity.session_user === "postgres"
      || identity.current_user.endsWith(expectedProjectRef)
      || identity.session_user.endsWith(expectedProjectRef);
    assert(roleMatches && identity.current_database === "postgres", "The authenticated database connection does not match the expected project.");

    const batches = (await client.query(
      "select id from private.import_batches where source_name = $1",
      [sourceName],
    )).rows;
    assert(batches.length === 1, "Expected exactly one approved historical import batch.");
    const batchId = batches[0].id;
    const games = (await client.query(
      "select game.id, provenance.source_game_id, provenance.source_game_key, provenance.exception_reference, game.played_on, game.game_number_on_date, game.pod_size, game.member_count, game.result_type, game.winning_seat, game.date_origin from private.historical_game_provenance as provenance join public.games as game on game.id = provenance.game_id where provenance.import_batch_id = $1 order by game.played_on, game.game_number_on_date",
      [batchId],
    )).rows;
    const gameIds = games.map((game) => game.id);
    const participants = (await client.query(
      "select game_id, seat, participant_type, player_id, deck_id, commander_id, coalesce(game.winning_seat = participant.seat, false) as is_winner from public.game_participants as participant join public.games as game on game.id = participant.game_id where game_id = any($1::uuid[]) order by game_id, seat",
      [gameIds],
    )).rows;
    const participantsByGame = new Map();
    for (const participant of participants) {
      const list = participantsByGame.get(participant.game_id) ?? [];
      list.push(participant);
      participantsByGame.set(participant.game_id, list);
    }

    const actual = {
      historical_games: games.length,
      seats_logged: participants.length,
      member_players: Number((await client.query(
        "select count(*)::integer as count from public.players where historical_player_key in ('nelson','will','manfred','josh','sam','keenan')",
      )).rows[0].count),
      guest_seat_appearances: 0,
      games_with_2plus_members: 0,
      games_with_2plus_members_and_single_winner: 0,
      official_four_player_single_winner_games: 0,
      excluded_less_than_two_members: 0,
      games_draw_or_shared_or_missing_winner: 0,
      date_carried_forward: 0,
      unique_canonical_commanders: Number((await client.query("select count(*)::integer as count from public.commanders")).rows[0].count),
      unique_member_decks: Number((await client.query("select count(*)::integer as count from public.member_decks")).rows[0].count),
      distinct_original_alias_pairs: Number((await client.query(
        "select count(*)::integer as count from private.commander_alias_provenance where import_batch_id = $1",
        [batchId],
      )).rows[0].count),
      all_guest_winner_seats: 0,
    };
    const sourceKeys = new Set();
    const dailyNumbers = new Set();
    let exceptionReferenceRows = 0;
    const specialResults = new Map();
    const podSizes = new Map();
    let invalidRosters = 0;
    for (const game of games) {
      assert(!sourceKeys.has(game.source_game_key), "Duplicate historical source game key found.");
      sourceKeys.add(game.source_game_key);
      const dailyKey = isoDate(game.played_on) + ":" + game.game_number_on_date;
      assert(!dailyNumbers.has(dailyKey), "Duplicate historical daily number found.");
      dailyNumbers.add(dailyKey);
      podSizes.set(Number(game.pod_size), (podSizes.get(Number(game.pod_size)) ?? 0) + 1);
      if (game.exception_reference && Object.keys(game.exception_reference).length > 0) exceptionReferenceRows += 1;
      if (["4P-0046", "4P-0067", "4P-0106"].includes(game.source_game_id)) specialResults.set(game.source_game_id, game.result_type);
      const rows = participantsByGame.get(game.id) ?? [];
      const seats = rows.map((row) => ({
        gameId: game.source_game_id,
        sourceGameKey: game.source_game_key,
        seat: Number(row.seat),
        playerId: row.player_id,
        deckId: row.deck_id,
        commanderId: row.commander_id,
        displayPlayer: row.participant_type === "guest" ? "Guest" : "Member",
        isWinner: row.is_winner,
      }));
      const result = game.result_type;
      const modelGame = {
        gameId: game.source_game_id,
        sourceGameKey: game.source_game_key,
        playedOn: isoDate(game.played_on),
        dateOrigin: game.date_origin === "carried_forward" ? "Carried forward" : "Explicit",
        podSize: Number(game.pod_size),
        memberCount: Number(game.member_count),
        result,
        winnerSeat: game.winning_seat === null ? null : Number(game.winning_seat),
        analyticsEligible: Number(game.member_count) >= 2,
        winStatsEligible: Number(game.member_count) >= 2 && result === "single_winner" && game.winning_seat !== null,
        officialFourPlayerWinStatsEligible: Number(game.member_count) >= 2 && result === "single_winner" && game.winning_seat !== null && Number(game.pod_size) === 4,
      };
      const errors = validateHistoricalGame(modelGame, seats);
      assert(errors.length === 0, "Hosted game validation failed for a historical roster.");
      const eligible = getEligibility(modelGame, seats);
      if (eligible.memberCount >= 2) actual.games_with_2plus_members += 1;
      else actual.excluded_less_than_two_members += 1;
      if (eligible.winStatsEligible) actual.games_with_2plus_members_and_single_winner += 1;
      if (eligible.officialFourPlayerWinStatsEligible) actual.official_four_player_single_winner_games += 1;
      if (result !== "single_winner") actual.games_draw_or_shared_or_missing_winner += 1;
      if (game.date_origin === "carried_forward") actual.date_carried_forward += 1;
      for (const row of rows) {
        if (row.participant_type === "guest") {
          actual.guest_seat_appearances += 1;
          if (row.is_winner) actual.all_guest_winner_seats += 1;
          assert(row.player_id === null && row.deck_id === null, "A guest seat has a member or deck ID.");
        } else {
          assert(row.player_id !== null && row.deck_id !== null, "A member seat is missing its identity or deck.");
        }
      }
      if (rows.length !== Number(game.pod_size) || rows.filter((row) => row.participant_type === "member").length !== Number(game.member_count)) invalidRosters += 1;
    }
    validateCounts(actual);
    assert(invalidRosters === 0, "One or more hosted rosters are incomplete.");
    assert(exceptionReferenceRows === 30, "Historical exception-reference count mismatch.");
    assert(JSON.stringify([...podSizes.entries()].sort((a, b) => a[0] - b[0])) === JSON.stringify([[3, 9], [4, 123], [5, 8], [6, 1]]), "Hosted pod-size totals differ from the contract.");
    assert(specialResults.get("4P-0046") === "draw" && specialResults.get("4P-0067") === "shared_winner" && specialResults.get("4P-0106") === "winner_missing", "Historical exceptional outcomes differ from the contract.");
    counts = {
      ...actual,
      exception_reference_rows: exceptionReferenceRows,
      pod_sizes: Object.fromEntries([...podSizes.entries()].sort((a, b) => a[0] - b[0])),
      invalid_rosters: invalidRosters,
      duplicate_source_keys: games.length - sourceKeys.size,
      duplicate_daily_numbers: games.length - dailyNumbers.size,
    };

    const privateNames = (await client.query(
      "select candidate.name from private.historical_game_provenance as provenance cross join lateral jsonb_array_elements(provenance.original_guest_names) as guest cross join lateral (values (guest.value ->> 'source_guest_name'), (guest.value ->> 'original_player_name')) as candidate(name) where provenance.import_batch_id = $1 and candidate.name is not null and length(candidate.name) >= 2",
      [batchId],
    )).rows;
    privateGuestNames = [...new Set(privateNames.map((row) => row.name))];
    const storedNotes = (await client.query(
      "select game.public_notes from private.historical_game_provenance as provenance join public.games as game on game.id = provenance.game_id where provenance.import_batch_id = $1 and game.public_notes is not null",
      [batchId],
    )).rows.map((row) => row.public_notes);
    assert(storedNotes.every((note) => !containsGuestName(note, privateGuestNames)), "A stored public note exposes a private guest name.");

    const rlsRows = (await client.query(
      "select schema.nspname as schema_name, relation.relname, relation.relrowsecurity, relation.relforcerowsecurity from pg_catalog.pg_class as relation join pg_catalog.pg_namespace as schema on schema.oid = relation.relnamespace where relation.relkind = 'r' and ((schema.nspname = 'public' and relation.relname in ('players','commanders','member_decks','games','game_participants')) or (schema.nspname = 'private' and relation.relname in ('user_memberships','import_batches','historical_game_provenance','commander_alias_provenance','game_audit')))",
    )).rows;
    assert(rlsRows.length === 10 && rlsRows.every((row) => row.relrowsecurity && row.relforcerowsecurity), "RLS is not enabled and forced on every expected table.");
    const policies = (await client.query(
      "select tablename, policyname, cmd, roles, qual, with_check from pg_catalog.pg_policies where schemaname = 'public' and cmd in ('INSERT','UPDATE','DELETE','ALL')",
    )).rows;
    const expectedPolicyNames = [
      "games_approved_member_insert",
      "participants_approved_member_insert",
      "games_admin_update",
      "games_admin_delete",
      "participants_admin_update",
      "participants_admin_delete",
      "players_owner_moxfield_update",
      "member_decks_owner_moxfield_update",
    ];
    assert(policies.length === expectedPolicyNames.length && expectedPolicyNames.every((name) => policies.some((row) => row.policyname === name)), "Unexpected or missing public write policies.");
    assert(policies.filter((row) => ["games", "game_participants"].includes(row.tablename) && (row.cmd === "UPDATE" || row.cmd === "DELETE")).every((row) => String(row.qual).includes("is_admin")), "A history edit/delete policy is not admin-only.");
    const moxfieldPolicies = policies.filter((row) => row.policyname.endsWith("_owner_moxfield_update"));
    assert(moxfieldPolicies.length === 2 && moxfieldPolicies.every((row) => row.cmd === "UPDATE" && String(row.roles).includes("authenticated") && String(row.qual).includes("is_admin") && String(row.qual).includes("is_approved_player_owner") && String(row.with_check).includes("is_approved_player_owner")), "Moxfield owner policies do not enforce approved ownership and administrator access.");
    const moxfieldGrants = (await client.query(
      "select has_column_privilege('authenticated','public.players','moxfield_url','UPDATE') as auth_player_link, has_column_privilege('authenticated','public.member_decks','moxfield_url','UPDATE') as auth_deck_link, has_column_privilege('authenticated','public.players','display_name','UPDATE') as auth_player_identity, has_column_privilege('authenticated','public.member_decks','owner_player_id','UPDATE') as auth_deck_identity, has_column_privilege('anon','public.players','moxfield_url','UPDATE') as anon_player_link, has_column_privilege('anon','public.member_decks','moxfield_url','UPDATE') as anon_deck_link",
    )).rows[0];
    assert(moxfieldGrants.auth_player_link && moxfieldGrants.auth_deck_link && !moxfieldGrants.auth_player_identity && !moxfieldGrants.auth_deck_identity && !moxfieldGrants.anon_player_link && !moxfieldGrants.anon_deck_link, "Moxfield update grants exceed the intended link columns or roles.");
    const privateGrants = (await client.query(
      "select has_schema_privilege('anon','private','USAGE') as anon_schema, has_table_privilege('anon','private.historical_game_provenance','SELECT') as anon_provenance, has_table_privilege('authenticated','private.historical_game_provenance','SELECT') as auth_provenance",
    )).rows[0];
    assert(!privateGrants.anon_schema && !privateGrants.anon_provenance && !privateGrants.auth_provenance, "Private guest provenance grants are too broad.");

    await client.query("begin");
    await client.query("set local role anon");
    const anonGameCount = Number((await client.query("select count(*)::integer as count from public.readable_games where source = 'spreadsheet'")).rows[0].count);
    const anonParticipants = (await client.query("select participant_type, public_player_name from public.readable_game_participants")).rows;
    const anonPrivateDenied = await expectDenied(client, "select * from private.historical_game_provenance limit 1");
    const anonInsertDenied = await expectDenied(client, "insert into public.games (played_on,pod_size,member_count,result_type,winning_seat,source,date_origin) values (current_date,3,2,'single_winner',1,'manual','manual')");

    await client.query("reset role");
    await client.query("set local role authenticated");
    const testAuthId = randomUUID();
    await client.query("select set_config('request.jwt.claim.sub',$1,true)", [testAuthId]);
    await client.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: testAuthId, role: "authenticated" })]);
    const testMembership = (await client.query("select private.is_approved_member() as approved, private.is_admin() as admin")).rows[0];
    const authPrivateDenied = await expectDenied(client, "select * from private.historical_game_provenance limit 1");
    const authInsertDenied = await expectDenied(client, "insert into public.games (played_on,pod_size,member_count,result_type,winning_seat,source,date_origin) values (current_date,3,2,'single_winner',1,'manual','manual')");
    const gameId = (await client.query("select id from public.games where source = 'spreadsheet' limit 1")).rows[0]?.id;
    const participant = (await client.query("select game_id, seat from public.game_participants limit 1")).rows[0];
    const authGameUpdateDenied = gameId ? await expectDenied(client, "update public.games set public_notes = 'permission probe' where id = '" + gameId + "'") : true;
    const authGameDeleteDenied = gameId ? await expectDenied(client, "delete from public.games where id = '" + gameId + "'") : true;
    const authParticipantUpdateDenied = participant ? await expectDenied(client, "update public.game_participants set seat = seat where game_id = '" + participant.game_id + "' and seat = " + Number(participant.seat)) : true;
    const authParticipantDeleteDenied = participant ? await expectDenied(client, "delete from public.game_participants where game_id = '" + participant.game_id + "' and seat = " + Number(participant.seat)) : true;
    await client.query("rollback");
    assert(anonGameCount === 141 && anonParticipants.length === 565, "Anonymous safe reads failed.");
    assert(anonParticipants.every((row) => row.participant_type !== "guest" || row.public_player_name === "Guest"), "Anonymous participant read exposed a guest name.");
    assert(anonPrivateDenied && anonInsertDenied, "Anonymous private-read or write denial failed.");
    assert(testMembership.approved === false && testMembership.admin === false, "Synthetic unmapped identity unexpectedly received membership privileges.");
    assert(authPrivateDenied && authInsertDenied, "Unmapped authenticated private-read or write denial failed.");
    assert(authGameUpdateDenied && authGameDeleteDenied && authParticipantUpdateDenied && authParticipantDeleteDenied, "Unmapped authenticated identity was able to mutate history.");
    const approvedAdminCount = Number((await client.query(
      "select count(*)::integer as count from private.user_memberships where role = 'admin' and approval_status = 'approved'",
    )).rows[0].count);
    securitySummary = {
      anon_private_read_denied: true,
      anon_insert_denied: true,
      authenticated_unmapped_private_read_denied: true,
      authenticated_unmapped_insert_denied: true,
      authenticated_unmapped_update_delete_denied: true,
      private_guest_provenance: "not readable by anon/authenticated",
      admin_policy_definitions: "4 admin-only update/delete policies present",
      approved_admin_accounts: approvedAdminCount,
      successful_admin_mutation: "verified in rollback-only Prompt 3 integration test",
    };
  } finally {
    await client.end().catch(() => {});
  }

  const publicGames = await safePublicRows(projectUrl, publicKey, "readable_games", {
    select: "id,source,public_notes,location",
    source: "eq.spreadsheet",
    limit: "1000",
  });
  const ids = publicGames.map((row) => row.id);
  const publicParticipants = await safePublicRows(projectUrl, publicKey, "readable_game_participants", {
    select: "game_id,seat,participant_type,public_player_name,is_winner",
    game_id: "in.(" + ids.join(",") + ")",
    limit: "1000",
  });
  assert(publicGames.length === 141 && publicParticipants.length === 565, "Public API row counts differ from the database.");
  assert(publicParticipants.every((row) => row.participant_type !== "guest" || row.public_player_name === "Guest"), "Public API returned a guest name.");
  assert(publicParticipants.every((row) => !("source_guest_name" in row) && !("original_player_name" in row)), "Public API returned a private provenance field.");
  assert(publicGames.every((row) => !row.public_notes || !containsGuestName(row.public_notes, privateGuestNames)), "Public API note contains a private guest name.");
  assert(publicParticipants.filter((row) => row.participant_type === "guest" && row.is_winner).length === expected.all_guest_winner_seats, "Public guest-winning seat count differs from the source contract.");

  console.log("Hosted database verification passed for project " + expectedProjectRef + ".");
  console.log("Reconciled counts: " + JSON.stringify(counts));
  console.log("Authorization/privacy checks: " + JSON.stringify(securitySummary));
  console.log("Public projections passed: 141 games, 565 seats, all guest labels sanitized, no raw guest-name fields.");
  console.log("Approved member and administrator mutation paths were exercised in rollback-only Prompt 3 tests.");
}

main().catch((error) => {
  const code = error?.code ? " (database error " + error.code + ")" : "";
  console.error("Hosted database verification failed" + code + ".");
  process.exitCode = 1;
});
