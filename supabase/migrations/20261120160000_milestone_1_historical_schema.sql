-- Milestone 1 historical schema and safe public projections. Apply with Supabase CLI.
-- Import guest/original source values only into private provenance; public views emit Guest.

begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated, service_role;

create table public.players (
  id uuid primary key default gen_random_uuid(),
  historical_player_key text not null unique,
  display_name text not null check (length(btrim(display_name)) > 0),
  moxfield_url text,
  created_at timestamptz not null default now(),
  constraint players_approved_historical_key check (
    historical_player_key in ('nelson', 'will', 'manfred', 'josh', 'sam', 'keenan')
  ),
  constraint players_moxfield_http_url check (
    moxfield_url is null or moxfield_url ~ '^https?://'
  )
);

create table public.commanders (
  id uuid primary key default gen_random_uuid(),
  historical_commander_key text not null unique,
  canonical_name text not null check (length(btrim(canonical_name)) > 0),
  created_at timestamptz not null default now()
);

create table public.member_decks (
  id uuid primary key default gen_random_uuid(),
  historical_deck_key text not null unique,
  owner_player_id uuid not null references public.players(id) on delete restrict,
  commander_id uuid not null references public.commanders(id) on delete restrict,
  display_name text,
  moxfield_url text,
  created_at timestamptz not null default now(),
  constraint member_decks_owner_commander_unique unique (owner_player_id, commander_id),
  constraint member_decks_id_owner_unique unique (id, owner_player_id),
  constraint member_decks_moxfield_http_url check (
    moxfield_url is null or moxfield_url ~ '^https?://'
  )
);

-- Importers must keep original source notes in private provenance and set public_notes only to safe text.
create table public.games (
  id uuid primary key default gen_random_uuid(),
  played_on date not null,
  game_number_on_date integer not null check (game_number_on_date > 0),
  pod_size smallint not null check (pod_size between 3 and 6),
  member_count smallint not null check (member_count between 0 and pod_size),
  result_type text not null check (result_type in ('single_winner', 'draw', 'shared_winner', 'winner_missing')),
  winning_seat smallint,
  source text not null check (source in ('spreadsheet', 'manual', 'play')),
  date_origin text not null check (date_origin in ('explicit', 'carried_forward', 'manual')),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  public_notes text,
  created_at timestamptz not null default now(),
  constraint games_date_sequence_unique unique (played_on, game_number_on_date),
  constraint games_winner_shape check (
    (result_type = 'single_winner' and winning_seat is not null and winning_seat between 1 and pod_size)
    or (result_type <> 'single_winner' and winning_seat is null)
  ),
  constraint games_manual_single_winner check (
    source = 'spreadsheet' or (result_type = 'single_winner' and winning_seat is not null)
  ),
  constraint games_source_date_origin check (
    (source = 'spreadsheet' and date_origin in ('explicit', 'carried_forward'))
    or (source in ('manual', 'play') and date_origin = 'manual')
  )
);

create table public.game_participants (
  game_id uuid not null references public.games(id) on delete cascade,
  seat smallint not null check (seat between 1 and 6),
  participant_type text not null check (participant_type in ('member', 'guest')),
  player_id uuid references public.players(id) on delete restrict,
  deck_id uuid,
  commander_id uuid not null references public.commanders(id) on delete restrict,
  primary key (game_id, seat),
  constraint game_participants_member_or_guest check (
    (participant_type = 'member' and player_id is not null and deck_id is not null)
    or (participant_type = 'guest' and player_id is null and deck_id is null)
  ),
  constraint game_participants_deck_owner_fk
    foreign key (deck_id, player_id)
    references public.member_decks(id, owner_player_id)
    on delete restrict
);

-- Winning-seat identity is independent of player_id, so a Guest can win.
-- Deferred to permit transactional insertion of a game followed by its seats.
alter table public.games
  add constraint games_winning_seat_participant_fk
  foreign key (id, winning_seat)
  references public.game_participants(game_id, seat)
  deferrable initially deferred;

create unique index game_participants_member_once_per_game
  on public.game_participants(game_id, player_id)
  where player_id is not null;
create index game_participants_player_idx on public.game_participants(player_id) where player_id is not null;
create index game_participants_commander_idx on public.game_participants(commander_id);
create index games_played_on_idx on public.games(played_on desc, game_number_on_date desc);

-- Auth identity and authorization are independent of a display name such as "Will".
create table private.user_memberships (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  player_id uuid unique references public.players(id) on delete restrict,
  role text not null check (role in ('member', 'admin')),
  approval_status text not null check (approval_status in ('pending', 'approved', 'revoked')),
  created_at timestamptz not null default now(),
  constraint approved_membership_needs_player check (approval_status <> 'approved' or player_id is not null)
);

create table private.import_batches (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  snapshot_sha256 text not null unique check (snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  source_counts jsonb not null default '{}'::jsonb,
  imported_at timestamptz,
  created_at timestamptz not null default now()
);

create table private.historical_game_provenance (
  id uuid primary key default gen_random_uuid(),
  game_id uuid unique references public.games(id) on delete set null,
  import_batch_id uuid not null references private.import_batches(id) on delete restrict,
  source_game_key text not null unique,
  source_game_id text not null unique,
  source_sheet_row text,
  original_winner_description text,
  exception_reference jsonb not null default '{}'::jsonb,
  raw_game_row jsonb not null,
  raw_participant_rows jsonb not null,
  original_guest_names jsonb not null default '[]'::jsonb,
  original_commander_labels jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index historical_game_provenance_game_idx on private.historical_game_provenance(game_id) where game_id is not null;

create table private.commander_alias_provenance (
  id uuid primary key default gen_random_uuid(),
  import_batch_id uuid not null references private.import_batches(id) on delete restrict,
  commander_id uuid not null references public.commanders(id) on delete restrict,
  source_alias_hash text not null check (source_alias_hash ~ '^[0-9a-f]{64}$'),
  source_alias jsonb not null,
  reviewed_canonical_name text not null,
  review_id text,
  created_at timestamptz not null default now(),
  constraint commander_alias_provenance_hash_unique unique (source_alias_hash)
);

create or replace function private.is_approved_member()
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select exists (
    select 1
    from private.user_memberships as membership
    where membership.auth_user_id = (select auth.uid())
      and membership.approval_status = 'approved'
      and membership.role in ('member', 'admin')
  );
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select exists (
    select 1
    from private.user_memberships as membership
    where membership.auth_user_id = (select auth.uid())
      and membership.approval_status = 'approved'
      and membership.role = 'admin'
  );
$$;

revoke all on function private.is_approved_member() from public, anon;
revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_approved_member() to authenticated, service_role;
grant execute on function private.is_admin() to authenticated, service_role;

alter table public.players enable row level security;
alter table public.players force row level security;
alter table public.commanders enable row level security;
alter table public.commanders force row level security;
alter table public.member_decks enable row level security;
alter table public.member_decks force row level security;
alter table public.games enable row level security;
alter table public.games force row level security;
alter table public.game_participants enable row level security;
alter table public.game_participants force row level security;

create policy players_public_read on public.players for select to anon, authenticated using (true);
create policy commanders_public_read on public.commanders for select to anon, authenticated using (true);
create policy member_decks_public_read on public.member_decks for select to anon, authenticated using (true);
create policy games_public_read on public.games for select to anon, authenticated using (true);
create policy game_participants_public_read on public.game_participants for select to anon, authenticated using (true);

-- No direct browser writes in the baseline schema; Prompt 2 adds narrowly scoped policies.
revoke all on table public.players, public.commanders, public.member_decks, public.games, public.game_participants from public, anon, authenticated;
revoke all on all tables in schema private from public, anon, authenticated;
grant all on all tables in schema private to service_role;

-- Grant only fields needed to build safe projections. Stable import IDs and raw provenance stay hidden.
grant select (id, display_name, moxfield_url) on public.players to anon, authenticated;
grant select (id, canonical_name) on public.commanders to anon, authenticated;
grant select (id, owner_player_id, commander_id, display_name, moxfield_url) on public.member_decks to anon, authenticated;
grant select (id, played_on, game_number_on_date, pod_size, member_count, result_type, winning_seat, source, date_origin, public_notes, created_at) on public.games to anon, authenticated;
grant select (game_id, seat, participant_type, player_id, deck_id, commander_id) on public.game_participants to anon, authenticated;

create view public.readable_players with (security_invoker = true) as
  select id, display_name, moxfield_url from public.players;

create view public.readable_commanders with (security_invoker = true) as
  select id, canonical_name from public.commanders;

create view public.readable_member_decks with (security_invoker = true) as
  select d.id, d.owner_player_id, p.display_name as owner_name, d.commander_id,
         c.canonical_name, coalesce(d.display_name, c.canonical_name) as deck_name,
         d.moxfield_url
  from public.member_decks as d
  join public.players as p on p.id = d.owner_player_id
  join public.commanders as c on c.id = d.commander_id;

create view public.readable_games with (security_invoker = true) as
  select id, played_on, game_number_on_date, pod_size, member_count, result_type,
         winning_seat, source, date_origin, public_notes, created_at
  from public.games;

create view public.readable_game_participants with (security_invoker = true) as
  select gp.game_id, gp.seat, gp.participant_type,
         case when gp.participant_type = 'guest' then 'Guest' else p.display_name end as public_player_name,
         gp.player_id, gp.deck_id, gp.commander_id, c.canonical_name as commander_name,
         case when gp.deck_id is null then null else coalesce(d.display_name, c.canonical_name) end as deck_name,
         coalesce(g.winning_seat = gp.seat, false) as is_winner
  from public.game_participants as gp
  join public.games as g on g.id = gp.game_id
  join public.commanders as c on c.id = gp.commander_id
  left join public.players as p on p.id = gp.player_id
  left join public.member_decks as d on d.id = gp.deck_id;

grant select on public.readable_players, public.readable_commanders,
  public.readable_member_decks, public.readable_games,
  public.readable_game_participants to anon, authenticated;

alter table private.user_memberships enable row level security;
alter table private.user_memberships force row level security;
alter table private.import_batches enable row level security;
alter table private.import_batches force row level security;
alter table private.historical_game_provenance enable row level security;
alter table private.historical_game_provenance force row level security;
alter table private.commander_alias_provenance enable row level security;
alter table private.commander_alias_provenance force row level security;
-- No anon/authenticated policies or grants exist for membership or provenance tables.

commit;
