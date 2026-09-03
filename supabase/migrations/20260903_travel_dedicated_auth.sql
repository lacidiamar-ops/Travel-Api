-- Comptes Auth dédiés à Travel : aucune dépendance avec Cook Pilot/Human.
-- Les utilisateurs sont créés via l'API Admin Auth ; leurs UUID sont liés ici.

alter table public.travel_team_members
  add column if not exists auth_uid uuid references auth.users(id) on delete set null;

create unique index if not exists travel_team_members_auth_uid_key
  on public.travel_team_members(auth_uid) where auth_uid is not null;

update public.travel_team_members
set auth_uid = case full_name
  when 'Amar Lacidi' then 'd3cfc0c3-cde3-49c9-ab83-1e6f7175ae49'::uuid
  when 'Igal Settbon' then 'ac71ad88-9757-4f93-808a-9f91dec68f5d'::uuid
  when 'Bastien Florido' then '30f5e6a8-91e6-4fdb-9626-703dc41d0faa'::uuid
  when 'Damien Cau' then '88783ee8-d980-4f39-9608-c6b3251b8aef'::uuid
  else auth_uid
end
where full_name in ('Amar Lacidi','Igal Settbon','Bastien Florido','Damien Cau');

create or replace function travel_private.current_employee_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select tm.assignment_employee_id
  from public.travel_team_members tm
  where tm.auth_uid = (select auth.uid()) and tm.active = true
  order by tm.display_order
  limit 1
$$;

create or replace function travel_private.is_manager()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.travel_team_members tm
    where tm.auth_uid = (select auth.uid())
      and tm.active = true
      and tm.full_name = 'Amar Lacidi'
  )
$$;

revoke all on function travel_private.current_employee_id() from public, anon;
revoke all on function travel_private.is_manager() from public, anon;
grant execute on function travel_private.current_employee_id() to authenticated;
grant execute on function travel_private.is_manager() to authenticated;
