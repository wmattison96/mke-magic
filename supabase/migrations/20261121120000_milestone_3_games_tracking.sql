-- Milestone 3: safe public game metadata, atomic manual entry, and audited admin corrections.
-- All browser writes go through narrow RPCs; raw guest provenance remains private.

begin;

alter table public.games
  add column location text check (location is null or length(btrim(location)) <= 120),
  add column client_submission_id uuid,
  add column submission_fingerprint text;

create unique index games_manual_submission_unique
  on public.games (created_by, client_submission_id)
  where client_submission_id is not null;

-- Names resolved by the card lookup or selected from the approved registry share one
-- normalized identity; historical canonical labels are left byte-for-byte unchanged.
create unique index commanders_canonical_name_normalized_unique
  on public.commanders ((lower(btrim(canonical_name))));

alter table private.game_audit add column change_reason text;

grant select (location) on public.games to anon, authenticated;
create or replace view public.readable_games with (security_invoker = true) as
  select id, played_on, game_number_on_date, pod_size, member_count, result_type,
         winning_seat, source, date_origin, public_notes, created_at, location
  from public.games;
grant select on public.readable_games to anon, authenticated;

create or replace function private.audit_game_change()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  old_value jsonb := to_jsonb(old);
  new_value jsonb;
  key_value text;
  reason_value text := nullif(pg_catalog.current_setting('app.game_audit_reason', true), '');
begin
  if tg_op = 'UPDATE' then
    new_value := to_jsonb(new);
  end if;

  if tg_table_name = 'games' then
    key_value := coalesce(old_value ->> 'id', 'unknown');
  else
    key_value := coalesce(old_value ->> 'game_id', 'unknown') || ':' || coalesce(old_value ->> 'seat', 'unknown');
  end if;

  insert into private.game_audit (
    actor_auth_user_id, entity_table, entity_key, operation, old_row, new_row, change_reason
  ) values (
    (select auth.uid()), tg_table_name, key_value, tg_op, old_value, new_value, reason_value
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
revoke all on function private.audit_game_change() from public, anon, authenticated;

create or replace function public.current_member_context()
returns jsonb
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select case
    when (select auth.uid()) is null then null
    else (
      select pg_catalog.jsonb_build_object(
        'playerId', player.id,
        'playerName', player.display_name,
        'role', membership.role,
        'approvalStatus', membership.approval_status
      )
      from private.user_memberships as membership
      left join public.players as player on player.id = membership.player_id
      where membership.auth_user_id = (select auth.uid())
    )
  end;
$$;
revoke all on function public.current_member_context() from public, anon;
grant execute on function public.current_member_context() to authenticated;

create or replace function private.resolve_manual_commander(
  p_commander_id uuid,
  p_commander_name text
)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  commander_key uuid;
  normalized_name text := nullif(pg_catalog.btrim(p_commander_name), '');
begin
  if p_commander_id is not null then
    select commander.id into commander_key
      from public.commanders as commander
      where commander.id = p_commander_id;
    if commander_key is null then
      raise exception 'Selected commander is not in the registry.' using errcode = '22023';
    end if;
    if normalized_name is not null and not exists (
      select 1 from public.commanders as commander
      where commander.id = commander_key and commander.canonical_name = normalized_name
    ) then
      raise exception 'Commander name does not match the selected registry entry.' using errcode = '22023';
    end if;
    return commander_key;
  end if;

  if normalized_name is null or pg_catalog.length(normalized_name) > 160 then
    raise exception 'Choose a canonical commander name.' using errcode = '22023';
  end if;

  insert into public.commanders (historical_commander_key, canonical_name)
  values (
    'manual:' || pg_catalog.md5(pg_catalog.lower(normalized_name)),
    normalized_name
  )
  on conflict ((pg_catalog.lower(pg_catalog.btrim(canonical_name)))) do nothing;

  select commander.id into commander_key
    from public.commanders as commander
    where pg_catalog.lower(pg_catalog.btrim(commander.canonical_name)) = pg_catalog.lower(normalized_name);
  return commander_key;
end;
$$;
revoke all on function private.resolve_manual_commander(uuid, text) from public, anon, authenticated;

create or replace function public.create_manual_game(
  p_client_submission_id uuid,
  p_played_on date,
  p_location text,
  p_public_notes text,
  p_seats jsonb,
  p_winning_seat smallint
)
returns table (game_id uuid, game_number_on_date integer)
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := (select auth.uid());
  existing_game public.games%rowtype;
  new_game_id uuid;
  new_game_number integer;
  fingerprint text;
  seat_data jsonb;
  seat_number integer;
  expected_seat integer := 1;
  member_id uuid;
  member_ids uuid[] := '{}'::uuid[];
  deck_id uuid;
  v_commander_id uuid;
  commander_name text;
  member_seats integer := 0;
  pod_size integer;
begin
  if actor_id is null then
    raise exception 'Sign in with an approved playgroup account to record games.' using errcode = '42501';
  end if;
  if not private.is_approved_member() then
    raise exception 'This account is not approved to record games.' using errcode = '42501';
  end if;
  if p_client_submission_id is null then
    raise exception 'A submission identifier is required.' using errcode = '22023';
  end if;
  if p_played_on is null or p_played_on > current_date then
    raise exception 'Choose a valid game date.' using errcode = '22023';
  end if;
  if p_location is not null and pg_catalog.length(pg_catalog.btrim(p_location)) > 120 then
    raise exception 'Location must be 120 characters or fewer.' using errcode = '22023';
  end if;
  if p_public_notes is not null and pg_catalog.length(p_public_notes) > 5000 then
    raise exception 'Notes must be 5,000 characters or fewer.' using errcode = '22023';
  end if;
  if p_seats is null or pg_catalog.jsonb_typeof(p_seats) <> 'array' then
    raise exception 'Add a complete roster of 3 to 6 seats.' using errcode = '22023';
  end if;
  pod_size := pg_catalog.jsonb_array_length(p_seats);
  if pod_size < 3 or pod_size > 6 then
    raise exception 'A game must have 3 to 6 seats.' using errcode = '22023';
  end if;
  if p_winning_seat is null or p_winning_seat < 1 or p_winning_seat > pod_size then
    raise exception 'Choose one winning seat.' using errcode = '22023';
  end if;

  fingerprint := pg_catalog.md5(pg_catalog.jsonb_build_object(
    'playedOn', p_played_on,
    'location', p_location,
    'notes', p_public_notes,
    'seats', p_seats,
    'winningSeat', p_winning_seat
  )::text);
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('mtg-game-submit:' || actor_id::text || ':' || p_client_submission_id::text, 0)
  );
  select game.* into existing_game
    from public.games as game
    where game.created_by = actor_id
      and game.client_submission_id = p_client_submission_id;
  if found then
    if existing_game.submission_fingerprint <> fingerprint then
      raise exception 'This submission identifier was already used for different game details.' using errcode = '22023';
    end if;
    return query select existing_game.id, existing_game.game_number_on_date;
    return;
  end if;

  insert into public.games (
    played_on, game_number_on_date, pod_size, member_count, result_type,
    winning_seat, source, date_origin, created_by, location, public_notes,
    client_submission_id, submission_fingerprint
  ) values (
    p_played_on, null, pod_size, 0, 'single_winner', p_winning_seat,
    'manual', 'manual', actor_id, nullif(pg_catalog.btrim(p_location), ''),
    nullif(p_public_notes, ''), p_client_submission_id, fingerprint
  ) returning id, games.game_number_on_date into new_game_id, new_game_number;

  for seat_data in
    select entries.value
    from pg_catalog.jsonb_array_elements(p_seats) as entries(value)
    order by (entries.value ->> 'seat')::integer
  loop
    if pg_catalog.jsonb_typeof(seat_data) <> 'object'
       or pg_catalog.jsonb_typeof(seat_data -> 'seat') <> 'number' then
      raise exception 'Each seat needs a seat number and participant.' using errcode = '22023';
    end if;
    if (seat_data ->> 'seat')::numeric <> (seat_data ->> 'seat')::integer then
      raise exception 'Seat order must use whole numbers.' using errcode = '22023';
    end if;
    seat_number := (seat_data ->> 'seat')::integer;
    if seat_number <> expected_seat then
      raise exception 'Seats must be unique and ordered from 1 through the pod size.' using errcode = '22023';
    end if;
    expected_seat := expected_seat + 1;

    commander_name := nullif(pg_catalog.btrim(seat_data ->> 'commanderName'), '');
    if nullif(seat_data ->> 'commanderId', '') is null then
      v_commander_id := private.resolve_manual_commander(null, commander_name);
    else
      v_commander_id := private.resolve_manual_commander((seat_data ->> 'commanderId')::uuid, commander_name);
    end if;

    if seat_data ->> 'participantType' = 'member' then
      if nullif(seat_data ->> 'playerId', '') is null then
        raise exception 'Choose a member for each member seat.' using errcode = '22023';
      end if;
      member_id := (seat_data ->> 'playerId')::uuid;
      if member_id = any(member_ids) then
        raise exception 'A member can only appear once in a game.' using errcode = '22023';
      end if;
      if not exists (select 1 from public.players as player where player.id = member_id) then
        raise exception 'Selected member is not in the playgroup.' using errcode = '22023';
      end if;
      member_ids := pg_catalog.array_append(member_ids, member_id);
      member_seats := member_seats + 1;

      deck_id := nullif(seat_data ->> 'deckId', '')::uuid;
      if deck_id is not null then
        if not exists (
          select 1 from public.member_decks as deck
          where deck.id = deck_id and deck.owner_player_id = member_id and deck.commander_id = v_commander_id
        ) then
          raise exception 'Selected deck must belong to this member and use its commander.' using errcode = '22023';
        end if;
      else
        insert into public.member_decks (historical_deck_key, owner_player_id, commander_id)
        values ('manual:' || member_id::text || ':' || v_commander_id::text, member_id, v_commander_id)
        on conflict (owner_player_id, commander_id) do nothing;
        select deck.id into deck_id
          from public.member_decks as deck
          where deck.owner_player_id = member_id and deck.commander_id = v_commander_id;
      end if;

      insert into public.game_participants (game_id, seat, participant_type, player_id, deck_id, commander_id)
      values (new_game_id, seat_number, 'member', member_id, deck_id, v_commander_id);
    elsif seat_data ->> 'participantType' = 'guest' then
      if nullif(seat_data ->> 'playerId', '') is not null or nullif(seat_data ->> 'deckId', '') is not null then
        raise exception 'Guest seats cannot use member or deck identities.' using errcode = '22023';
      end if;
      insert into public.game_participants (game_id, seat, participant_type, player_id, deck_id, commander_id)
      values (new_game_id, seat_number, 'guest', null, null, v_commander_id);
    else
      raise exception 'Choose a member or Guest for every seat.' using errcode = '22023';
    end if;
  end loop;

  update public.games as game set member_count = member_seats where game.id = new_game_id;
  return query select game.id, game.game_number_on_date from public.games as game where game.id = new_game_id;
end;
$$;
revoke all on function public.create_manual_game(uuid, date, text, text, jsonb, smallint) from public, anon;
grant execute on function public.create_manual_game(uuid, date, text, text, jsonb, smallint) to authenticated;

create or replace function public.correct_completed_game(
  p_game_id uuid,
  p_played_on date,
  p_location text,
  p_public_notes text,
  p_result_type text,
  p_winning_seat smallint,
  p_change_reason text
)
returns table (game_id uuid, game_number_on_date integer)
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  game_row public.games%rowtype;
  next_number integer;
  reason_value text := pg_catalog.btrim(p_change_reason);
begin
  if (select auth.uid()) is null or not private.is_admin() then
    raise exception 'Only an approved administrator can correct completed games.' using errcode = '42501';
  end if;
  if reason_value is null or pg_catalog.length(reason_value) < 8 or pg_catalog.length(reason_value) > 500 then
    raise exception 'Enter a correction reason between 8 and 500 characters.' using errcode = '22023';
  end if;
  if p_played_on is null or p_played_on > current_date then
    raise exception 'Choose a valid game date.' using errcode = '22023';
  end if;
  if p_location is not null and pg_catalog.length(pg_catalog.btrim(p_location)) > 120 then
    raise exception 'Location must be 120 characters or fewer.' using errcode = '22023';
  end if;
  if p_public_notes is not null and pg_catalog.length(p_public_notes) > 5000 then
    raise exception 'Notes must be 5,000 characters or fewer.' using errcode = '22023';
  end if;
  select game.* into game_row from public.games as game where game.id = p_game_id for update;
  if not found then
    raise exception 'Game not found.' using errcode = 'P0002';
  end if;
  if p_result_type not in ('single_winner', 'draw', 'shared_winner', 'winner_missing') then
    raise exception 'Choose a recognized result type.' using errcode = '22023';
  end if;
  if (p_result_type = 'single_winner' and (p_winning_seat is null or p_winning_seat < 1 or p_winning_seat > game_row.pod_size))
     or (p_result_type <> 'single_winner' and p_winning_seat is not null) then
    raise exception 'The winner seat must match the selected result type.' using errcode = '22023';
  end if;
  if p_winning_seat is not null and not exists (
    select 1 from public.game_participants as participant
    where participant.game_id = p_game_id and participant.seat = p_winning_seat
  ) then
    raise exception 'The selected winner seat is not in this game.' using errcode = '22023';
  end if;

  perform pg_catalog.set_config('app.game_audit_reason', reason_value, true);
  if p_played_on is distinct from game_row.played_on then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('mtg-game-date:' || p_played_on::text, 0)
    );
    select coalesce(pg_catalog.max(game.game_number_on_date), 0) + 1
      into next_number from public.games as game where game.played_on = p_played_on;
  else
    next_number := game_row.game_number_on_date;
  end if;

  update public.games as game set
    played_on = p_played_on,
    game_number_on_date = next_number,
    location = nullif(pg_catalog.btrim(p_location), ''),
    public_notes = nullif(p_public_notes, ''),
    result_type = p_result_type,
    winning_seat = p_winning_seat
  where game.id = p_game_id;
  return query select game.id, game.game_number_on_date from public.games as game where game.id = p_game_id;
end;
$$;
revoke all on function public.correct_completed_game(uuid, date, text, text, text, smallint, text) from public, anon;
grant execute on function public.correct_completed_game(uuid, date, text, text, text, smallint, text) to authenticated;

create or replace function public.delete_completed_game(
  p_game_id uuid,
  p_change_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  reason_value text := pg_catalog.btrim(p_change_reason);
begin
  if (select auth.uid()) is null or not private.is_admin() then
    raise exception 'Only an approved administrator can delete completed games.' using errcode = '42501';
  end if;
  if reason_value is null or pg_catalog.length(reason_value) < 8 or pg_catalog.length(reason_value) > 500 then
    raise exception 'Enter a deletion reason between 8 and 500 characters.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.games as game where game.id = p_game_id) then
    raise exception 'Game not found.' using errcode = 'P0002';
  end if;
  perform pg_catalog.set_config('app.game_audit_reason', reason_value, true);
  delete from public.games as game where game.id = p_game_id;
end;
$$;
revoke all on function public.delete_completed_game(uuid, text) from public, anon;
grant execute on function public.delete_completed_game(uuid, text) to authenticated;

-- Revoke every direct API write path. The RPCs above perform authorization and
-- keep parent game + complete roster in one transaction.
revoke insert, update, delete on table public.games from authenticated;
revoke insert (played_on, pod_size, member_count, result_type, winning_seat, source, date_origin)
  on table public.games from authenticated;
revoke update (played_on, pod_size, member_count, result_type, winning_seat, source, date_origin, public_notes)
  on table public.games from authenticated;
revoke insert, update, delete on table public.game_participants from authenticated;
revoke insert (game_id, seat, participant_type, player_id, deck_id, commander_id)
  on table public.game_participants from authenticated;
revoke update (seat, participant_type, player_id, deck_id, commander_id)
  on table public.game_participants from authenticated;

comment on function public.create_manual_game(uuid, date, text, text, jsonb, smallint) is
  'Atomically records a complete manual game and its seats for a verified approved member; retries with the same submission ID return the existing game only when the payload matches.';
comment on function public.correct_completed_game(uuid, date, text, text, text, smallint, text) is
  'Admin-only correction; requires a reason, preserves date sequence stability, and writes private before/after audit rows.';
comment on function public.delete_completed_game(uuid, text) is
  'Admin-only deletion; requires a reason and writes private before/after audit rows for the game and cascade-deleted seats.';

commit;
