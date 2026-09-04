begin;

-- Les membres d'un déplacement peuvent lire uniquement les messages rattachés
-- à cette mission. L'accès global et les modifications restent réservés au manager.
drop policy if exists travel_inbox_read_assigned_mission on public.travel_inbox;
create policy travel_inbox_read_assigned_mission
on public.travel_inbox
for select
to authenticated
using (
  travel_private.is_manager()
  or (
    matched_mission_id is not null
    and travel_private.has_mission_assignment(matched_mission_id)
  )
);

commit;
