begin;

-- Recommendations are durable work items derived from measurement and crawl
-- evidence. Alerts still represent operational incidents; this table keeps
-- improvement work deduplicated, assignable, and measurable until an operator
-- completes, dismisses, or lets it expire.
create table if not exists public.seo_recommendations (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null check (char_length(dedupe_key) between 8 and 240),
  severity text not null default 'p2' check (severity in ('p0', 'p1', 'p2')),
  category text not null check (char_length(category) between 2 and 80),
  title text not null check (char_length(title) between 3 and 180),
  message text not null check (char_length(message) between 3 and 4_000),
  recommended_action text not null check (char_length(recommended_action) between 3 and 2_000),
  page_id uuid references public.seo_pages(id) on delete set null,
  canonical_url text check (canonical_url is null or canonical_url ~ '^https://'),
  query text check (query is null or char_length(query) between 1 and 2_048),
  source_loop text not null check (char_length(source_loop) between 3 and 100),
  source_run_id uuid references public.seo_job_runs(id) on delete set null,
  evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence) = 'object'),
  status text not null default 'open' check (status in ('open', 'acknowledged', 'in_progress', 'completed', 'dismissed', 'expired')),
  assigned_to uuid references public.content_members(user_id) on delete set null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  due_at timestamptz,
  resolved_at timestamptz,
  resolution_note text check (resolution_note is null or char_length(resolution_note) <= 4_000),
  outcome jsonb not null default '{}'::jsonb check (jsonb_typeof(outcome) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A recommendation can be re-opened after completion, but only one active
-- work item for a dedupe key may exist at a time. This preserves outcome
-- history while preventing repeated daily imports from creating duplicates.
create unique index if not exists seo_recommendations_active_dedupe_idx
  on public.seo_recommendations (dedupe_key)
  where status in ('open', 'acknowledged', 'in_progress');
create index if not exists seo_recommendations_queue_idx
  on public.seo_recommendations (status, severity, last_seen_at desc);
create index if not exists seo_recommendations_category_idx
  on public.seo_recommendations (category, status, last_seen_at desc);
create index if not exists seo_recommendations_page_idx
  on public.seo_recommendations (page_id, status, last_seen_at desc)
  where page_id is not null;
create index if not exists seo_recommendations_due_idx
  on public.seo_recommendations (due_at, status)
  where due_at is not null and status in ('open', 'acknowledged', 'in_progress');

drop trigger if exists seo_recommendations_updated_at on public.seo_recommendations;
create trigger seo_recommendations_updated_at
before update on public.seo_recommendations
for each row execute function public.set_seo_updated_at();

create or replace function public.get_seo_recommendation_summary(since_date date)
returns jsonb
language sql
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'generatedAt', now(),
    'open', (select count(*) from public.seo_recommendations where status = 'open'),
    'acknowledged', (select count(*) from public.seo_recommendations where status = 'acknowledged'),
    'inProgress', (select count(*) from public.seo_recommendations where status = 'in_progress'),
    'completed', (select count(*) from public.seo_recommendations where status = 'completed'),
    'dismissed', (select count(*) from public.seo_recommendations where status = 'dismissed'),
    'expired', (select count(*) from public.seo_recommendations where status = 'expired'),
    'overdue', (select count(*) from public.seo_recommendations where status in ('open', 'acknowledged', 'in_progress') and due_at < now()),
    'createdSince', (select count(*) from public.seo_recommendations where created_at >= since_date::timestamptz)
  );
$$;

alter table public.seo_recommendations enable row level security;
revoke all on public.seo_recommendations from anon, authenticated;
grant select, insert, update, delete on public.seo_recommendations to service_role;

revoke all on function public.get_seo_recommendation_summary(date) from public, anon, authenticated;
grant execute on function public.get_seo_recommendation_summary(date) to service_role;

comment on table public.seo_recommendations is
  'Durable, deduplicated SEO improvement work items with evidence and outcomes.';

commit;
