-- Travel OM PRO: operational travel context is shared with every active team member.
-- Flight tickets remain private and require an explicit employee attribution.

alter table public.travel_documents
  add column if not exists employee_id uuid;

comment on column public.travel_documents.employee_id is
  'Required owner for flight_ticket documents; null flight tickets remain manager-only.';

drop policy if exists travel_assignments_read_mission_team on public.travel_assignments;
drop policy if exists travel_assignments_read_team on public.travel_assignments;
create policy travel_assignments_read_team
on public.travel_assignments
for select
to authenticated
using ((select travel_private.is_active_team_member()));

drop policy if exists travel_inbox_read_assigned_mission on public.travel_inbox;
drop policy if exists travel_inbox_read_team on public.travel_inbox;
create policy travel_inbox_read_team
on public.travel_inbox
for select
to authenticated
using (
  matched_mission_id is not null
  and (select travel_private.is_active_team_member())
);

drop policy if exists travel_documents_read_assigned on public.travel_documents;
drop policy if exists travel_documents_read_supplier_summaries on public.travel_documents;
drop policy if exists travel_documents_read_team_or_personal_flight on public.travel_documents;
create policy travel_documents_read_team_or_personal_flight
on public.travel_documents
for select
to authenticated
using (
  (select travel_private.is_active_team_member())
  and (
    coalesce(document_type, '') <> 'flight_ticket'
    or employee_id = (select travel_private.current_employee_id())
    or metadata ->> 'employee_id' = (select travel_private.current_employee_id())::text
    or metadata ->> 'assigned_employee_id' = (select travel_private.current_employee_id())::text
    or metadata ->> 'employee_name' = (
      select tm.full_name from public.travel_team_members tm
      where tm.auth_uid = (select auth.uid()) and tm.active = true
      order by tm.display_order limit 1
    )
    or metadata ->> 'passenger_name' = (
      select tm.full_name from public.travel_team_members tm
      where tm.auth_uid = (select auth.uid()) and tm.active = true
      order by tm.display_order limit 1
    )
    or metadata ->> 'assigned_to' = (
      select tm.full_name from public.travel_team_members tm
      where tm.auth_uid = (select auth.uid()) and tm.active = true
      order by tm.display_order limit 1
    )
    or coalesce(metadata -> 'assigned_people', '[]'::jsonb) ? (
      select tm.full_name from public.travel_team_members tm
      where tm.auth_uid = (select auth.uid()) and tm.active = true
      order by tm.display_order limit 1
    )
  )
);

drop policy if exists travel_legs_read_assigned on public.travel_legs;
drop policy if exists travel_legs_read_team on public.travel_legs;
create policy travel_legs_read_team
on public.travel_legs
for select
to authenticated
using ((select travel_private.is_active_team_member()));

drop policy if exists travel_app_links_read_assigned on public.travel_app_links;
drop policy if exists travel_app_links_read_team on public.travel_app_links;
create policy travel_app_links_read_team
on public.travel_app_links
for select
to authenticated
using (active = true and (select travel_private.is_active_team_member()));
