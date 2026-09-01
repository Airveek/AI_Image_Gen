begin;

-- Durable post-publish probes make the publish sequence observable at the
-- same checkpoints used by the operating playbook. A unique row per page and
-- stage keeps retries idempotent and prevents probe storms.
create table if not exists public.seo_page_probes (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.seo_pages(id) on delete cascade,
  canonical_url text not null check (canonical_url ~ '^https://'),
  stage text not null check (stage in ('five_minutes', 'one_day', 'seven_days')),
  scheduled_for timestamptz not null,
  checked_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'pass', 'fail')),
  http_status integer check (http_status is null or http_status between 100 and 599),
  response_ms integer check (response_ms is null or response_ms >= 0),
  declared_canonical_url text,
  robots_directive text,
  title text,
  h1_count integer check (h1_count is null or h1_count >= 0),
  schema_types text[] not null default '{}',
  content_hash text,
  issue_codes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (page_id, stage)
);

create index if not exists seo_page_probes_due_idx
  on public.seo_page_probes (stage, scheduled_for, status);
create index if not exists seo_page_probes_page_checked_idx
  on public.seo_page_probes (page_id, checked_at desc);

alter table public.seo_page_probes enable row level security;
revoke all on public.seo_page_probes from anon, authenticated;
grant select, insert, update, delete on public.seo_page_probes to service_role;

drop trigger if exists seo_page_probes_updated_at on public.seo_page_probes;
create trigger seo_page_probes_updated_at
before update on public.seo_page_probes
for each row execute function public.set_seo_updated_at();

comment on table public.seo_page_probes is
  'Idempotent five-minute, one-day, and seven-day rendered URL health probes.';

commit;
