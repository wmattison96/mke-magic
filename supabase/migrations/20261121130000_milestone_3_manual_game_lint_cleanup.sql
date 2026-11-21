-- Keep the manual game RPC body free of unused PL/pgSQL state flagged by db lint.
-- The function's authorization, idempotency, and write behavior are unchanged.

begin;

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
  ) returning id into new_game_id;

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

comment on function public.create_manual_game(uuid, date, text, text, jsonb, smallint) is
  'Atomically records a complete manual game and its seats for a verified approved member; retries with the same submission ID return the existing game only when the payload matches.';

commit;
