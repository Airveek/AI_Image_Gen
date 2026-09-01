begin;

-- Consent-gated, anonymous Core Web Vitals samples. This table intentionally
-- stores no user agent, IP address, query string, or authenticated user ID.
create table if not exists public.seo_web_vitals (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique check (char_length(event_key) between 16 and 160),
  anonymous_id_hash text check (anonymous_id_hash is null or char_length(anonymous_id_hash) between 32 and 128),
  page_id uuid references public.seo_pages(id) on delete set null,
  page_path text not null check (page_path like '/%' and char_length(page_path) <= 500),
  metric_name text not null check (metric_name in ('lcp', 'inp', 'cls')),
  value numeric(14, 4) not null check (value >= 0),
  rating text not null check (rating in ('good', 'needs-improvement', 'poor')),
  navigation_type text not null default 'unknown' check (navigation_type in ('navigate', 'reload', 'back_forward', 'prerender', 'unknown')),
  occurred_at timestamptz not null,
  received_at timestamptz not null default now()
);

create index if not exists seo_web_vitals_metric_occurred_idx
  on public.seo_web_vitals (metric_name, occurred_at desc);
create index if not exists seo_web_vitals_page_metric_idx
  on public.seo_web_vitals (page_id, metric_name, occurred_at desc)
  where page_id is not null;

alter table public.seo_web_vitals enable row level security;
revoke all on public.seo_web_vitals from anon, authenticated;
grant insert, select on public.seo_web_vitals to service_role;

comment on table public.seo_web_vitals is
  'Consent-gated anonymous Core Web Vitals samples used for aggregate P75 reporting.';

commit;
