-- Milestone 5: let approved members maintain only their own Moxfield links.
-- Existing columns and public read projections already exist; this is additive
-- and grants no permission to change game, player, or deck identity fields.

begin;

create or replace function private.is_approved_player_owner(p_player_id uuid)
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
      and membership.player_id = p_player_id
      and membership.approval_status = 'approved'
      and membership.role in ('member', 'admin')
  );
$$;

revoke all on function private.is_approved_player_owner(uuid) from public, anon;
grant execute on function private.is_approved_player_owner(uuid) to authenticated, service_role;

create policy players_owner_moxfield_update on public.players
  for update to authenticated
  using ((select private.is_admin()) or (select private.is_approved_player_owner(id)))
  with check ((select private.is_admin()) or (select private.is_approved_player_owner(id)));

create policy member_decks_owner_moxfield_update on public.member_decks
  for update to authenticated
  using ((select private.is_admin()) or (select private.is_approved_player_owner(owner_player_id)))
  with check ((select private.is_admin()) or (select private.is_approved_player_owner(owner_player_id)));

revoke update on public.players, public.member_decks from public, anon, authenticated;
grant update (moxfield_url) on public.players, public.member_decks to authenticated;

comment on function private.is_approved_player_owner(uuid) is
  'Confirms that the signed-in approved member is mapped to the requested player record.';

commit;
