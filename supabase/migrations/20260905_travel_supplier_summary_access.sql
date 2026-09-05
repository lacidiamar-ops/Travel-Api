-- All four active Travel profiles can read supplier offer summaries.
-- Other travel documents remain limited to the manager or assigned mission team.
create or replace function travel_private.is_active_team_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.travel_team_members tm
    where tm.auth_uid = (select auth.uid())
      and tm.active = true
  );
$$;

revoke all on function travel_private.is_active_team_member() from public;
grant execute on function travel_private.is_active_team_member() to authenticated;

drop policy if exists travel_documents_read_supplier_summaries on public.travel_documents;
create policy travel_documents_read_supplier_summaries
on public.travel_documents
for select
to authenticated
using (
  document_type = 'caterer_quote'
  and coalesce(metadata ->> 'document_status', '') <> 'request'
  and (select travel_private.is_active_team_member())
);

drop policy if exists travel_missions_read_team_context on public.travel_missions;
create policy travel_missions_read_team_context
on public.travel_missions
for select
to authenticated
using ((select travel_private.is_active_team_member()));
