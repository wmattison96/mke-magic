-- Milestone 2 authorization foundation. Apply with Supabase CLI after reviewing
-- the complete migration set; this file is not run by the app.

begin;

create table private.game_audit (
  id bigint generated always as identity primary key,
  actor_auth_user_id uuid,
  entity_table text not null check (entity_table in ('games', 'game_participants')),
  entity_key text not null,
  operation text not null check (operation in ('UPDATE', 'DELETE')),
  old_row jsonb not null,
  new_row jsonb,
  changed_at timestamptz not null default now()
);
alter table private.game_audit enable row level security;
alter table private.game_audit force row level security;
revoke all on table private.game_audit from public, anon, authenticated;
grant select on table private.game_audit to service_role;

create or replace function private.is_game_author(p_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select exists (
    select 1
    from public.games as game
    where game.id = p_game_id
      and game.created_by = (select auth.uid())
  );
$$;
revoke all on function private.is_game_author(uuid) from public, anon;
grant execute on function private.is_game_author(uuid) to authenticated, service_role;

create or replace function private.assign_game_number_on_date()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  if new.game_number_on_date is null then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('mtg-game-date:' || new.played_on::text, 0)
    );
    select coalesce(max(game.game_number_on_date), 0) + 1
      into new.game_number_on_date
      from public.games as game
      where game.played_on = new.played_on;
  end if;
  return new;
end;
$$;
revoke all on function private.assign_game_number_on_date() from public, anon, authenticated;
drop trigger if exists games_assign_daily_number on public.games;
create trigger games_assign_daily_number
  before insert on public.games
  for each row execute function private.assign_game_number_on_date();

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
    actor_auth_user_id, entity_table, entity_key, operation, old_row, new_row
  ) values (
    (select auth.uid()), tg_table_name, key_value, tg_op, old_value, new_value
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
revoke all on function private.audit_game_change() from public, anon, authenticated;
drop trigger if exists games_audit_update_delete on public.games;
create trigger games_audit_update_delete
  after update or delete on public.games
  for each row execute function private.audit_game_change();
drop trigger if exists participants_audit_update_delete on public.game_participants;
create trigger participants_audit_update_delete
  after update or delete on public.game_participants
  for each row execute function private.audit_game_change();

create policy games_approved_member_insert on public.games
  for insert to authenticated
  with check (
    (select private.is_approved_member())
    and created_by = (select auth.uid())
    and source = 'manual'
    and date_origin = 'manual'
    and result_type = 'single_winner'
    and winning_seat is not null
  );

create policy participants_approved_member_insert on public.game_participants
  for insert to authenticated
  with check (
    (select private.is_approved_member())
    and (select private.is_game_author(game_id))
  );

create policy games_admin_update on public.games
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));
create policy games_admin_delete on public.games
  for delete to authenticated
  using ((select private.is_admin()));

create policy participants_admin_update on public.game_participants
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));
create policy participants_admin_delete on public.game_participants
  for delete to authenticated
  using ((select private.is_admin()));

-- No direct user-controlled daily numbers or created_by values. The date-number
-- trigger supplies the next free number while holding a per-date transaction lock.
grant insert (played_on, pod_size, member_count, result_type, winning_seat, source, date_origin)
  on public.games to authenticated;
grant update (played_on, pod_size, member_count, result_type, winning_seat, source, date_origin, public_notes)
  on public.games to authenticated;
grant delete on public.games to authenticated;

grant insert (game_id, seat, participant_type, player_id, deck_id, commander_id)
  on public.game_participants to authenticated;
grant update (seat, participant_type, player_id, deck_id, commander_id)
  on public.game_participants to authenticated;
grant delete on public.game_participants to authenticated;

comment on function private.is_game_author(uuid) is
  'Returns only whether the verified caller created the referenced game; used by participant insert RLS.';
comment on function private.assign_game_number_on_date() is
  'Assigns a concurrency-safe next game number for new games; supplied historical numbers are preserved.';
comment on function private.audit_game_change() is
  'Stores before/after game rows in a private table for admin corrections.';

-- RLS policies alone cannot guarantee that separate API requests eventually
-- produce a complete roster. A deferred constraint checks the whole game at
-- transaction commit, including seat continuity and the declared member count.
create or replace function private.assert_complete_game_roster()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  game_key uuid;
  game_row public.games%rowtype;
  seat_count integer;
  member_seat_count integer;
  first_seat integer;
  last_seat integer;
begin
  if tg_table_name = 'games' then
    game_key := new.id;
  elsif tg_op = 'DELETE' then
    game_key := old.game_id;
  else
    game_key := new.game_id;
  end if;

  select * into game_row from public.games where id = game_key;
  if not found then
    return null;
  end if;

  select count(*), count(*) filter (where participant_type = 'member'), min(seat), max(seat)
    into seat_count, member_seat_count, first_seat, last_seat
    from public.game_participants
    where game_id = game_key;

  if seat_count <> game_row.pod_size
     or member_seat_count <> game_row.member_count
     or first_seat <> 1
     or last_seat <> game_row.pod_size then
    raise exception 'Game roster must contain every seat and match its member count.'
      using errcode = '23514';
  end if;
  return null;
end;
$$;
revoke all on function private.assert_complete_game_roster() from public, anon, authenticated;

drop trigger if exists games_complete_roster_check on public.games;
create constraint trigger games_complete_roster_check
  after insert or update on public.games
  deferrable initially deferred
  for each row execute function private.assert_complete_game_roster();
drop trigger if exists participants_complete_roster_check on public.game_participants;
create constraint trigger participants_complete_roster_check
  after insert or update or delete on public.game_participants
  deferrable initially deferred
  for each row execute function private.assert_complete_game_roster();

commit;
