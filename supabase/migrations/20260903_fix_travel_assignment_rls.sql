-- Évite la récursion RLS quand un membre consulte le binôme de sa mission.

create or replace function travel_private.has_mission_assignment(p_mission_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.travel_assignments a
    where a.mission_id = p_mission_id
      and a.employee_id = travel_private.current_employee_id()
  )
$$;

revoke all on function travel_private.has_mission_assignment(uuid) from public, anon;
grant execute on function travel_private.has_mission_assignment(uuid) to authenticated;

drop policy if exists travel_assignments_read_mission_team on public.travel_assignments;
create policy travel_assignments_read_mission_team on public.travel_assignments for select to authenticated using (
  travel_private.is_manager()
  or travel_private.has_mission_assignment(mission_id)
);

drop policy if exists travel_documents_read_assigned on public.travel_documents;
create policy travel_documents_read_assigned on public.travel_documents for select to authenticated using (
  travel_private.is_manager()
  or (mission_id is not null and travel_private.has_mission_assignment(mission_id))
);

drop policy if exists travel_app_links_read_assigned on public.travel_app_links;
create policy travel_app_links_read_assigned on public.travel_app_links for select to authenticated using (
  travel_private.is_manager()
  or (
    active = true
    and mission_id is null
    and exists (
      select 1 from public.travel_team_members tm
      where tm.assignment_employee_id = travel_private.current_employee_id()
        and tm.active = true
    )
  )
  or (mission_id is not null and travel_private.has_mission_assignment(mission_id))
);
