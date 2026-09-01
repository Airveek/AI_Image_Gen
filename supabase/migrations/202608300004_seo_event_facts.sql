begin;

create table if not exists public.seo_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique check (char_length(event_key) between 16 and 160),
  event_name text not null check (event_name in (
    'seo_page_view',
    'seo_result_gallery_engaged',
    'seo_prompt_copied',
    'seo_preset_opened',
    'seo_upload_started',
    'seo_internal_link_clicked'
  )),
  anonymous_id_hash text check (anonymous_id_hash is null or char_length(anonymous_id_hash) between 32 and 128),
  page_id uuid references public.seo_pages(id) on delete set null,
  content_id text not null check (char_length(content_id) between 1 and 160),
  properties jsonb not null default '{}'::jsonb check (jsonb_typeof(properties) = 'object'),
  consent_state text not null check (consent_state = 'granted'),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists seo_events_page_occurred_idx
  on public.seo_events (page_id, occurred_at desc) where page_id is not null;
create index if not exists seo_events_name_occurred_idx
  on public.seo_events (event_name, occurred_at desc);

alter table public.seo_events enable row level security;
revoke all on public.seo_events from anon, authenticated;
grant insert, select on public.seo_events to service_role;

comment on table public.seo_events is
  'Consent-gated, non-PII SEO interaction facts; GA4 remains the behavioral reporting source of truth.';

commit;
