import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import pg from "pg";

const { Client } = pg;
const expectedProjectRef = "tuiripvkrvlfvkgunohu";
const migrations = [
  { version: "20261121120000", file: "20261121120000_milestone_3_games_tracking.sql" },
  { version: "20261121130000", file: "20261121130000_milestone_3_manual_game_lint_cleanup.sql" },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function expectSqlError(client, expectedCode, label, operation) {
  await client.query("savepoint m3_expected_rejection");
  let receivedCode = null;
  try {
    await operation();
  } catch (error) {
    receivedCode = error?.code ?? null;
  }
  await client.query("rollback to savepoint m3_expected_rejection");
  await client.query("release savepoint m3_expected_rejection");
  assert(receivedCode === expectedCode, label + " returned " + (receivedCode ?? "no error") + " instead of the expected rejection.");
}

async function main() {
  const connectionString = process.env.SUPABASE_DB_URL;
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  assert(connectionString && projectUrl, "Set the Supabase values in the ignored .env.local.");
  assert(new URL(projectUrl).hostname.split(".")[0] === expectedProjectRef, "The configured project URL is not the expected Supabase project.");
  const parsedConnection = new URL(connectionString);
  assert(parsedConnection.hostname.includes(expectedProjectRef) || decodeURIComponent(parsedConnection.username).endsWith("." + expectedProjectRef), "The database connection does not identify the expected Supabase project.");

  const client = new Client({ connectionString, connectionTimeoutMillis: 12000 });
  let baseline;
  let transactionOpen = false;
  try {
    await client.connect();
    const identity = (await client.query(
      "select current_database() as database_name, (select rolsuper or rolbypassrls from pg_catalog.pg_roles where rolname = current_user) as privileged",
    )).rows[0];
    assert(identity.database_name === "postgres" && identity.privileged === true, "The database connection must have the intended migration/import permissions.");

    const migrationStatus = await client.query(
      "select version from supabase_migrations.schema_migrations where version = any($1::text[])",
      [migrations.map((migration) => migration.version)],
    );
    const appliedVersions = new Set(migrationStatus.rows.map((row) => row.version));

    baseline = (await client.query(
      "select (select count(*)::integer from public.games) as games, (select count(*)::integer from public.game_participants) as seats",
    )).rows[0];

    await client.query("begin");
    transactionOpen = true;
    let previewedMigration = false;
    for (const migration of migrations) {
      if (appliedVersions.has(migration.version)) continue;
      const migrationSql = await readFile(new URL("../supabase/migrations/" + migration.file, import.meta.url), "utf8");
      const transactionalMigration = migrationSql.replace(/^\s*begin;\s*/i, "").replace(/\s*commit;\s*$/i, "");
      await client.query(transactionalMigration);
      previewedMigration = true;
    }
    if (previewedMigration) {
      console.log("Migration syntax/object creation: passed in a rollback-only database transaction.");
    }

    const adminMapping = (await client.query(
      "select membership.auth_user_id, membership.player_id from private.user_memberships as membership join public.players as player on player.id = membership.player_id where player.historical_player_key = $1 and membership.role = $2 and membership.approval_status = $3",
      ["will", "admin", "approved"],
    )).rows;
    assert(adminMapping.length === 1, "Expected the approved Will administrator mapping to exist.");
    const authUserId = adminMapping[0].auth_user_id;
    const willPlayerId = adminMapping[0].player_id;
    const commanderRows = (await client.query("select id from public.commanders order by historical_commander_key limit 4")).rows;
    assert(commanderRows.length >= 3, "At least three existing commanders are required for the rollback-only game test.");
    const newCommanderForWill = (await client.query(
      "select commander.id from public.commanders as commander where not exists (select 1 from public.member_decks as deck where deck.owner_player_id = $1 and deck.commander_id = commander.id) order by commander.historical_commander_key limit 1",
      [willPlayerId],
    )).rows[0]?.id;
    assert(newCommanderForWill, "An unregistered member + commander identity is required for the atomic deck-creation test.");
    const manfredDeck = (await client.query(
      "select deck.id, deck.commander_id from public.member_decks as deck join public.players as player on player.id = deck.owner_player_id where player.historical_player_key = $1 order by deck.historical_deck_key limit 1",
      ["manfred"],
    )).rows[0];
    assert(manfredDeck, "The member deck needed for the ownership rejection test is missing.");

    await client.query("update private.user_memberships set role = 'member' where auth_user_id = $1", [authUserId]);
    await client.query("select set_config('request.jwt.claim.sub', $1, true)", [authUserId]);
    await client.query("set local role authenticated");

    const ownContext = (await client.query("select public.current_member_context() as context")).rows[0].context;
    assert(ownContext?.playerId === willPlayerId && ownContext?.role === "member" && ownContext?.approvalStatus === "approved", "The approved member context was not restricted to the mapped caller.");

    await expectSqlError(client, "42501", "Direct authenticated game writes", () => client.query(
      "insert into public.games (played_on, game_number_on_date, pod_size, member_count, result_type, winning_seat, source, date_origin) values (current_date, 1, 3, 1, 'single_winner', 1, 'manual', 'manual')",
    ));

    const testSubmissionId = randomUUID();
    const playedOn = new Date().toISOString().slice(0, 10);
    const validSeats = [
      { seat: 1, participantType: "member", playerId: willPlayerId, deckId: null, commanderId: newCommanderForWill, commanderName: null },
      { seat: 2, participantType: "guest", playerId: null, deckId: null, commanderId: commanderRows[1].id, commanderName: null },
      { seat: 3, participantType: "guest", playerId: null, deckId: null, commanderId: commanderRows[2].id, commanderName: null },
    ];
    const createArgs = {
      p_client_submission_id: testSubmissionId,
      p_played_on: playedOn,
      p_location: "Rollback-only Prompt 3 verification",
      p_public_notes: "This test record is rolled back in full.",
      p_seats: validSeats,
      p_winning_seat: 3,
    };
    const created = (await client.query(
      "select * from public.create_manual_game($1, $2::date, $3, $4, $5::jsonb, $6::smallint)",
      [createArgs.p_client_submission_id, createArgs.p_played_on, createArgs.p_location, createArgs.p_public_notes, JSON.stringify(createArgs.p_seats), createArgs.p_winning_seat],
    )).rows[0];
    assert(created?.game_id && Number(created.game_number_on_date) > 0, "Approved member game submission did not succeed.");
    const createdDecks = Number((await client.query(
      "select count(*)::integer as count from public.member_decks where owner_player_id = $1 and commander_id = $2",
      [willPlayerId, newCommanderForWill],
    )).rows[0].count);
    assert(createdDecks === 1, "The member + commander deck was not registered automatically.");
    const createdSeats = (await client.query(
      "select seat, participant_type, player_id, deck_id from public.game_participants where game_id = $1 order by seat",
      [created.game_id],
    )).rows;
    assert(createdSeats.length === 3 && createdSeats[2].seat === 3 && createdSeats[2].participant_type === "guest" && createdSeats[2].player_id === null && createdSeats[2].deck_id === null, "Guest seats were assigned a member or deck identity, or the guest winner was not preserved by seat.");
    const sanitizedSeats = (await client.query(
      "select participant_type, public_player_name from public.readable_game_participants where game_id = $1 order by seat",
      [created.game_id],
    )).rows;
    assert(sanitizedSeats.filter((row) => row.participant_type === "guest").every((row) => row.public_player_name === "Guest"), "The manual game projection exposed a guest label.");
    console.log("Approved member submission, atomic deck registration, full seat roster, and Guest winner: passed.");

    const retried = (await client.query(
      "select * from public.create_manual_game($1, $2::date, $3, $4, $5::jsonb, $6::smallint)",
      [createArgs.p_client_submission_id, createArgs.p_played_on, createArgs.p_location, createArgs.p_public_notes, JSON.stringify(createArgs.p_seats), createArgs.p_winning_seat],
    )).rows[0];
    assert(retried.game_id === created.game_id && Number(retried.game_number_on_date) === Number(created.game_number_on_date), "An exact retry did not return the existing game.");
    await expectSqlError(client, "22023", "Submission key reuse with a changed payload", () => client.query(
      "select * from public.create_manual_game($1, $2::date, $3, $4, $5::jsonb, $6::smallint)",
      [createArgs.p_client_submission_id, createArgs.p_played_on, createArgs.p_location, "different payload", JSON.stringify(createArgs.p_seats), createArgs.p_winning_seat],
    ));
    const nextSameDay = (await client.query(
      "select * from public.create_manual_game($1, $2::date, $3, $4, $5::jsonb, $6::smallint)",
      [randomUUID(), createArgs.p_played_on, createArgs.p_location, "A distinct second rollback-only game.", JSON.stringify(createArgs.p_seats), createArgs.p_winning_seat],
    )).rows[0];
    assert(Number(nextSameDay.game_number_on_date) === Number(created.game_number_on_date) + 1, "The per-date sequence did not allocate the next stable game number.");
    console.log("Submission idempotency and conflicting-key rejection: passed.");

    await expectSqlError(client, "22023", "Duplicate member seat", () => client.query(
      "select * from public.create_manual_game($1, $2::date, $3, $4, $5::jsonb, $6::smallint)",
      [randomUUID(), playedOn, null, null, JSON.stringify([
        { ...validSeats[0], seat: 1 },
        { ...validSeats[0], seat: 2 },
        validSeats[2],
      ]), 3],
    ));
    await expectSqlError(client, "22023", "Non-contiguous seat order", () => client.query(
      "select * from public.create_manual_game($1, $2::date, $3, $4, $5::jsonb, $6::smallint)",
      [randomUUID(), playedOn, null, null, JSON.stringify([
        { ...validSeats[0], seat: 1 },
        { ...validSeats[1], seat: 3 },
        { ...validSeats[2], seat: 4 },
      ]), 3],
    ));
    await expectSqlError(client, "22023", "Winner seat outside the pod", () => client.query(
      "select * from public.create_manual_game($1, $2::date, $3, $4, $5::jsonb, $6::smallint)",
      [randomUUID(), playedOn, null, null, JSON.stringify(validSeats), 4],
    ));
    await expectSqlError(client, "22023", "Deck ownership mismatch", () => client.query(
      "select * from public.create_manual_game($1, $2::date, $3, $4, $5::jsonb, $6::smallint)",
      [randomUUID(), playedOn, null, null, JSON.stringify([
        { seat: 1, participantType: "member", playerId: willPlayerId, deckId: manfredDeck.id, commanderId: manfredDeck.commander_id, commanderName: null },
        validSeats[1],
        validSeats[2],
      ]), 3],
    ));
    await expectSqlError(client, "42501", "Member correction permission", () => client.query(
      "select * from public.correct_completed_game($1, $2::date, $3, $4, $5, $6::smallint, $7)",
      [created.game_id, playedOn, null, null, "single_winner", 3, "Member cannot correct"],
    ));

    await client.query("select set_config('request.jwt.claim.sub', $1, true)", [randomUUID()]);
    await expectSqlError(client, "42501", "Unmapped account game submission", () => client.query(
      "select * from public.create_manual_game($1, $2::date, $3, $4, $5::jsonb, $6::smallint)",
      [randomUUID(), playedOn, null, null, JSON.stringify(validSeats), 3],
    ));

    await client.query("reset role");
    await client.query("update private.user_memberships set role = 'admin' where auth_user_id = $1", [authUserId]);
    await client.query("select set_config('request.jwt.claim.sub', $1, true)", [authUserId]);
    await client.query("set local role authenticated");
    const adminContext = (await client.query("select public.current_member_context() as context")).rows[0].context;
    assert(adminContext?.role === "admin" && adminContext?.playerId === willPlayerId, "The approved administrator mapping was not returned correctly.");
    const corrected = (await client.query(
      "select * from public.correct_completed_game($1, $2::date, $3, $4, $5, $6::smallint, $7)",
      [created.game_id, playedOn, "Corrected in rollback-only test", "Correction audit before delete.", "single_winner", 3, "Rollback-only correction audit verification"],
    )).rows[0];
    assert(corrected.game_id === created.game_id, "Administrator correction did not succeed.");

    await client.query("reset role");
    const updateAudit = (await client.query(
      "select old_row, new_row, change_reason, actor_auth_user_id from private.game_audit where entity_table = 'games' and entity_key = $1 and operation = 'UPDATE' order by id desc limit 1",
      [created.game_id],
    )).rows[0];
    assert(updateAudit?.change_reason === "Rollback-only correction audit verification" && updateAudit?.actor_auth_user_id === authUserId, "Administrator correction reason or actor was not audited.");
    assert(updateAudit.old_row.public_notes === createArgs.p_public_notes && updateAudit.new_row.public_notes === "Correction audit before delete.", "The correction before/after values were not audited.");
    await client.query("set local role authenticated");
    await client.query("select public.delete_completed_game($1, $2)", [created.game_id, "Rollback-only delete audit verification"]);
    await client.query("reset role");
    const deleteAudits = (await client.query(
      "select entity_table, change_reason from private.game_audit where (entity_key = $1 or entity_key like $2) and operation = 'DELETE'",
      [created.game_id, created.game_id + ":%"],
    )).rows;
    assert(deleteAudits.filter((row) => row.entity_table === "games" && row.change_reason === "Rollback-only delete audit verification").length === 1, "The game deletion audit record or reason is missing.");
    assert(deleteAudits.filter((row) => row.entity_table === "game_participants" && row.change_reason === "Rollback-only delete audit verification").length === 3, "Cascade-deleted seat audit records are missing.");
    console.log("Approved administrator correction and game/seat deletion audits: passed.");

    await client.query("rollback");
    transactionOpen = false;
    const after = (await client.query(
      "select (select count(*)::integer from public.games) as games, (select count(*)::integer from public.game_participants) as seats",
    )).rows[0];
    assert(after.games === baseline.games && after.seats === baseline.seats, "Rollback-only test changed the hosted game history.");
    console.log("Rollback check: no test games, seats, role changes, or audit rows remain.");
    console.log("Authorization and transaction tests completed against the expected Supabase project.");
  } finally {
    if (transactionOpen) await client.query("rollback").catch(() => {});
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Hosted Prompt 3 verification failed.");
  process.exitCode = 1;
});
