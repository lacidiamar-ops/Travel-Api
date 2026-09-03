-- Accès Travel indépendant des noms de démonstration de Cook Pilot Human.
-- Les comptes PIN techniques existent déjà dans Supabase Auth.

create or replace function travel_private.current_employee_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select tm.assignment_employee_id from public.travel_team_members tm
     where tm.assignment_employee_id = (select auth.uid()) and tm.active = true
     order by tm.display_order limit 1),
    (select e.id from public.cph_employees e
     where e.auth_uid = (select auth.uid()) and e.active = true
     order by e.created_at asc limit 1)
  )
$$;

create or replace function travel_private.is_manager()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.travel_team_members tm
    where tm.assignment_employee_id = (select auth.uid()) and tm.active = true and tm.full_name = 'Amar Lacidi')
  or exists (select 1 from public.cph_employees e
    where e.auth_uid = (select auth.uid()) and e.active = true and lower(coalesce(e.role,'')) = 'manager')
$$;

revoke all on function travel_private.current_employee_id() from public, anon;
revoke all on function travel_private.is_manager() from public, anon;
grant execute on function travel_private.current_employee_id() to authenticated;
grant execute on function travel_private.is_manager() to authenticated;

drop policy if exists travel_assignments_read_self_manager on public.travel_assignments;
create policy travel_assignments_read_mission_team on public.travel_assignments for select to authenticated using (
  travel_private.is_manager() or employee_id = travel_private.current_employee_id()
  or exists (select 1 from public.travel_assignments own_assignment
    where own_assignment.mission_id = travel_assignments.mission_id
      and own_assignment.employee_id = travel_private.current_employee_id())
);

drop policy if exists travel_documents_read_assigned on public.travel_documents;
create policy travel_documents_read_assigned on public.travel_documents for select to authenticated using (
  travel_private.is_manager() or (mission_id is not null and exists (
    select 1 from public.travel_assignments a where a.mission_id = travel_documents.mission_id
      and a.employee_id = travel_private.current_employee_id()))
);

drop policy if exists travel_app_links_read_assigned on public.travel_app_links;
create policy travel_app_links_read_assigned on public.travel_app_links for select to authenticated using (
  travel_private.is_manager()
  or (active = true and mission_id is null and exists (select 1 from public.travel_team_members tm
    where tm.assignment_employee_id = travel_private.current_employee_id() and tm.active = true))
  or exists (select 1 from public.travel_assignments a where a.mission_id = travel_app_links.mission_id
    and a.employee_id = travel_private.current_employee_id())
);
