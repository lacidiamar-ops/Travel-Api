begin;

alter table public.travel_documents
  drop constraint if exists travel_documents_document_type_check;

alter table public.travel_documents
  add constraint travel_documents_document_type_check
  check (document_type = any (array[
    'roadmap',
    'flight_ticket',
    'train_ticket',
    'hotel_confirmation',
    'rooming',
    'menu',
    'cdc',
    'audit',
    'invoice',
    'image',
    'caterer_quote',
    'other'
  ]));

update public.travel_app_links
set active = false,
    updated_at = now()
where label = 'Devis traiteurs'
  and url = 'https://api-devis-studio.vercel.app/';

insert into public.travel_ingest_rules (
  rule_name,
  channel,
  subject_keywords,
  body_keywords,
  group_keywords,
  classification,
  priority,
  require_trip_context,
  auto_process,
  active,
  metadata
)
values (
  'caterer_quote_documents',
  'gmail',
  array['devis','offre','proposition','traiteur','catering','pizza','pizzeria','sushi','repas','commande'],
  array['devis','offre','proposition','traiteur','catering','pizza','pizzeria','sushi','repas','commande'],
  array[]::text[],
  'caterer_quote',
  45,
  true,
  true,
  true,
  jsonb_build_object(
    'document_type', 'caterer_quote',
    'supplier_types', jsonb_build_array('traiteur','pizza','sushi'),
    'scope', 'om_professional_away_travel'
  )
)
on conflict (rule_name) do update
set channel = excluded.channel,
    subject_keywords = excluded.subject_keywords,
    body_keywords = excluded.body_keywords,
    group_keywords = excluded.group_keywords,
    classification = excluded.classification,
    priority = excluded.priority,
    require_trip_context = excluded.require_trip_context,
    auto_process = excluded.auto_process,
    active = excluded.active,
    metadata = excluded.metadata,
    updated_at = now();

commit;
