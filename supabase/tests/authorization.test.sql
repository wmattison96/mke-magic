-- Run after the migrations with npx supabase test db.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

set local role anon;
select extensions.throws_ok(
  $$select * from private.historical_game_provenance$$,
  '42501',
  'anonymous users cannot read private guest provenance'
);
select extensions.lives_ok(
  $$select id from public.readable_games limit 1$$,
  'anonymous users can query the safe game projection'
);
select extensions.throws_ok(
  $$insert into public.games (played_on, pod_size, member_count, result_type, winning_seat, source, date_origin)
    values ('2026-01-01', 3, 2, 'single_winner', 1, 'manual', 'manual')$$,
  '42501',
  'anonymous users cannot create games'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select extensions.throws_ok(
  $$select * from private.historical_game_provenance$$,
  '42501',
  'authenticated users cannot read private guest provenance'
);
select extensions.throws_ok(
  $$insert into public.games (played_on, pod_size, member_count, result_type, winning_seat, source, date_origin)
    values ('2026-01-01', 3, 2, 'single_winner', 1, 'manual', 'manual')$$,
  '42501',
  'unmapped authenticated users cannot create games'
);

select * from extensions.finish();
rollback;
