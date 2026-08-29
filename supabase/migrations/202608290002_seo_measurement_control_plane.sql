begin;

create table if not exists public.seo_touchpoints (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique check (char_length(event_key) between 16 and 160),
  anonymous_id_hash text not null check (char_length(anonymous_id_hash) between 32 and 128),
  page_id uuid references public.seo_pages(id) on delete set null,
  content_id text check (content_id is null or char_length(content_id) between 1 and 160),
  landing_path text not null check (landing_path like '/%' and char_length(landing_path) <= 500),
  source text not null check (char_length(source) between 1 and 120),
  medium text not null check (char_length(medium) between 1 and 120),
  campaign text check (campaign is null or char_length(campaign) between 1 and 160),
  referrer_host text check (referrer_host is null or char_length(referrer_host) <= 255),
  consent_state text not null check (consent_state in ('granted', 'denied', 'unknown')),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists seo_touchpoints_anonymous_occurred_idx
  on public.seo_touchpoints (anonymous_id_hash, occurred_at desc);
create index if not exists seo_touchpoints_page_occurred_idx
  on public.seo_touchpoints (page_id, occurred_at desc) where page_id is not null;

create table if not exists public.seo_user_attribution (
  user_id uuid primary key references auth.users(id) on delete cascade,
  anonymous_id_hash text not null check (char_length(anonymous_id_hash) between 32 and 128),
  first_touch_id uuid references public.seo_touchpoints(id) on delete set null,
  last_non_direct_touch_id uuid references public.seo_touchpoints(id) on delete set null,
  first_content_id text check (first_content_id is null or char_length(first_content_id) <= 160),
  last_content_id text check (last_content_id is null or char_length(last_content_id) <= 160),
  source_basis text not null default 'journey_linked'
    check (source_basis in ('journey_linked', 'self_reported', 'campaign_window', 'unknown')),
  source_confidence smallint not null default 100 check (source_confidence between 0 and 100),
  linked_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists seo_user_attribution_anonymous_idx
  on public.seo_user_attribution (anonymous_id_hash);

create table if not exists public.seo_gsc_page_daily (
  metric_date date not null,
  page_id uuid references public.seo_pages(id) on delete set null,
  canonical_url text not null,
  country text not null default 'all',
  device text not null default 'all',
  search_type text not null default 'web',
  clicks bigint not null default 0 check (clicks >= 0),
  impressions bigint not null default 0 check (impressions >= 0),
  ctr numeric(10, 8) not null default 0 check (ctr between 0 and 1),
  position numeric(10, 4) not null default 0 check (position >= 0),
  imported_at timestamptz not null default now(),
  primary key (metric_date, canonical_url, country, device, search_type)
);

create index if not exists seo_gsc_page_daily_page_date_idx
  on public.seo_gsc_page_daily (page_id, metric_date desc) where page_id is not null;
create index if not exists seo_gsc_page_daily_date_impressions_idx
  on public.seo_gsc_page_daily (metric_date desc, impressions desc);

create table if not exists public.seo_gsc_query_page_daily (
  metric_date date not null,
  page_id uuid references public.seo_pages(id) on delete set null,
  canonical_url text not null,
  query text not null check (char_length(query) between 1 and 2048),
  country text not null default 'all',
  device text not null default 'all',
  search_type text not null default 'web',
  clicks bigint not null default 0 check (clicks >= 0),
  impressions bigint not null default 0 check (impressions >= 0),
  ctr numeric(10, 8) not null default 0 check (ctr between 0 and 1),
  position numeric(10, 4) not null default 0 check (position >= 0),
  imported_at timestamptz not null default now(),
  primary key (metric_date, canonical_url, query, country, device, search_type)
);

create index if not exists seo_gsc_query_page_daily_page_date_idx
  on public.seo_gsc_query_page_daily (page_id, metric_date desc) where page_id is not null;
create index if not exists seo_gsc_query_page_daily_opportunity_idx
  on public.seo_gsc_query_page_daily (metric_date desc, impressions desc, position);

create table if not exists public.seo_ga4_landing_daily (
  metric_date date not null,
  page_id uuid references public.seo_pages(id) on delete set null,
  landing_path text not null,
  source text not null default 'all',
  medium text not null default 'all',
  sessions bigint not null default 0 check (sessions >= 0),
  engaged_sessions bigint not null default 0 check (engaged_sessions >= 0),
  signups bigint not null default 0 check (signups >= 0),
  first_generations bigint not null default 0 check (first_generations >= 0),
  checkout_starts bigint not null default 0 check (checkout_starts >= 0),
  purchases bigint not null default 0 check (purchases >= 0),
  revenue numeric(18, 4) not null default 0,
  currency text not null default 'USD' check (char_length(currency) = 3),
  imported_at timestamptz not null default now(),
  primary key (metric_date, landing_path, source, medium, currency)
);

create index if not exists seo_ga4_landing_daily_page_date_idx
  on public.seo_ga4_landing_daily (page_id, metric_date desc) where page_id is not null;

create table if not exists public.seo_bing_page_daily (
  metric_date date not null,
  page_id uuid references public.seo_pages(id) on delete set null,
  canonical_url text not null,
  clicks bigint not null default 0 check (clicks >= 0),
  impressions bigint not null default 0 check (impressions >= 0),
  ctr numeric(10, 8) not null default 0 check (ctr between 0 and 1),
  position numeric(10, 4) not null default 0 check (position >= 0),
  crawled_pages bigint not null default 0 check (crawled_pages >= 0),
  crawl_errors bigint not null default 0 check (crawl_errors >= 0),
  imported_at timestamptz not null default now(),
  primary key (metric_date, canonical_url)
);

create index if not exists seo_bing_page_daily_page_date_idx
  on public.seo_bing_page_daily (page_id, metric_date desc) where page_id is not null;

create table if not exists public.seo_url_state (
  id uuid primary key default gen_random_uuid(),
  page_id uuid unique references public.seo_pages(id) on delete set null,
  canonical_url text not null unique,
  sitemap_url text,
  eligible_for_indexing boolean not null default true,
  first_published_at timestamptz,
  first_sitemap_at timestamptz,
  first_crawled_at timestamptz,
  first_indexed_at timestamptz,
  first_impression_at timestamptz,
  first_click_at timestamptz,
  first_conversion_at timestamptz,
  last_crawled_at timestamptz,
  last_http_status integer check (last_http_status is null or last_http_status between 100 and 599),
  last_canonical_url text,
  last_robots_directive text,
  google_inspection_verdict text,
  google_inspected_at timestamptz,
  bing_index_status text,
  bing_inspected_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists seo_url_state_crawl_queue_idx
  on public.seo_url_state (eligible_for_indexing, last_crawled_at nulls first);
create index if not exists seo_url_state_google_verdict_idx
  on public.seo_url_state (google_inspection_verdict, google_inspected_at desc);

create table if not exists public.seo_crawl_runs (
  id uuid primary key default gen_random_uuid(),
  run_key text not null unique check (char_length(run_key) between 8 and 160),
  trigger_kind text not null check (trigger_kind in ('publish', 'scheduled', 'deploy', 'manual')),
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed', 'skipped')),
  checked_count integer not null default 0 check (checked_count >= 0),
  issue_count integer not null default 0 check (issue_count >= 0),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error_code text,
  note text
);

create table if not exists public.seo_crawl_snapshots (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.seo_crawl_runs(id) on delete cascade,
  page_id uuid references public.seo_pages(id) on delete set null,
  canonical_url text not null,
  fetched_url text not null,
  http_status integer check (http_status is null or http_status between 100 and 599),
  response_ms integer check (response_ms is null or response_ms >= 0),
  declared_canonical_url text,
  robots_directive text,
  title text,
  h1_count integer check (h1_count is null or h1_count >= 0),
  schema_types text[] not null default '{}',
  content_hash text,
  issue_codes text[] not null default '{}',
  crawled_at timestamptz not null default now(),
  unique (run_id, canonical_url)
);

create index if not exists seo_crawl_snapshots_page_crawled_idx
  on public.seo_crawl_snapshots (page_id, crawled_at desc) where page_id is not null;

create table if not exists public.seo_link_edges (
  id uuid primary key default gen_random_uuid(),
  source_page_id uuid references public.seo_pages(id) on delete set null,
  source_url text not null,
  target_page_id uuid references public.seo_pages(id) on delete set null,
  target_url text not null,
  anchor_text text not null default '',
  placement text not null default 'body' check (placement in ('body', 'navigation', 'breadcrumb', 'related', 'footer', 'other')),
  nofollow boolean not null default false,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (source_url, target_url, anchor_text, placement)
);

create index if not exists seo_link_edges_target_idx on public.seo_link_edges (target_url);
create index if not exists seo_link_edges_source_idx on public.seo_link_edges (source_url);

create table if not exists public.seo_quality_snapshots (
  id uuid primary key default gen_random_uuid(),
  page_id uuid references public.seo_pages(id) on delete set null,
  canonical_url text not null,
  content_version text not null,
  rubric_version text not null,
  overall_score smallint not null check (overall_score between 0 and 100),
  technical_score smallint not null check (technical_score between 0 and 100),
  intent_score smallint not null check (intent_score between 0 and 100),
  evidence_score smallint not null check (evidence_score between 0 and 100),
  originality_score smallint not null check (originality_score between 0 and 100),
  usefulness_score smallint not null check (usefulness_score between 0 and 100),
  hard_fail_codes text[] not null default '{}',
  evidence jsonb not null default '{}'::jsonb,
  evaluated_at timestamptz not null default now(),
  unique (canonical_url, content_version, rubric_version)
);

create index if not exists seo_quality_snapshots_page_evaluated_idx
  on public.seo_quality_snapshots (page_id, evaluated_at desc) where page_id is not null;

create table if not exists public.seo_job_runs (
  id uuid primary key default gen_random_uuid(),
  loop_name text not null check (char_length(loop_name) between 3 and 100),
  idempotency_key text not null unique check (char_length(idempotency_key) between 8 and 180),
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed', 'skipped')),
  checked_count integer not null default 0 check (checked_count >= 0),
  acted_count integer not null default 0 check (acted_count >= 0),
  note text,
  error_code text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists seo_job_runs_loop_started_idx
  on public.seo_job_runs (loop_name, started_at desc);

create table if not exists public.seo_job_state (
  loop_name text primary key,
  cursor jsonb not null default '{}'::jsonb,
  handled jsonb not null default '[]'::jsonb,
  cooldowns jsonb not null default '{}'::jsonb,
  last_run_at timestamptz,
  last_success_at timestamptz,
  consecutive_failures integer not null default 0 check (consecutive_failures >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.seo_alerts (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null check (char_length(dedupe_key) between 8 and 180),
  severity text not null check (severity in ('p0', 'p1', 'p2')),
  category text not null check (char_length(category) between 2 and 80),
  title text not null check (char_length(title) between 3 and 180),
  message text not null,
  entity_type text,
  entity_id text,
  evidence jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz
);

create unique index if not exists seo_alerts_open_dedupe_idx
  on public.seo_alerts (dedupe_key) where status in ('open', 'acknowledged');
create index if not exists seo_alerts_status_severity_idx
  on public.seo_alerts (status, severity, last_seen_at desc);

create table if not exists public.seo_automation_config (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  crawl_enabled boolean not null default false,
  source_sync_enabled boolean not null default false,
  recommendations_enabled boolean not null default false,
  alert_webhook_enabled boolean not null default false,
  crawl_batch_size integer not null default 50 check (crawl_batch_size between 1 and 500),
  daily_publish_limit integer not null default 200 check (daily_publish_limit between 0 and 10000),
  daily_publish_wave_size integer not null default 50 check (daily_publish_wave_size between 1 and 500),
  gsc_inspection_daily_budget integer not null default 1000 check (gsc_inspection_daily_budget between 0 and 10000),
  pause_reason text,
  updated_at timestamptz not null default now()
);

insert into public.seo_automation_config (id) values (true)
on conflict (id) do nothing;

create or replace function public.get_seo_dashboard_summary(since_date date)
returns jsonb
language sql
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'generatedAt', now(),
    'publishedUrls', (select count(*) from public.seo_url_state where first_published_at is not null),
    'crawlableUrls', (select count(*) from public.seo_url_state where eligible_for_indexing and last_http_status = 200 and coalesce(last_robots_directive, '') not ilike '%noindex%'),
    'verifiedIndexedUrls', (select count(*) from public.seo_url_state where google_inspection_verdict in ('PASS', 'VERDICT_PASS', 'indexed')),
    'impressionActiveUrls', (select count(distinct canonical_url) from public.seo_gsc_page_daily where metric_date >= since_date and country = 'all' and device = 'all' and search_type = 'web' and impressions > 0),
    'googleClicks', (select coalesce(sum(clicks), 0) from public.seo_gsc_page_daily where metric_date >= since_date and country = 'all' and device = 'all' and search_type = 'web'),
    'googleImpressions', (select coalesce(sum(impressions), 0) from public.seo_gsc_page_daily where metric_date >= since_date and country = 'all' and device = 'all' and search_type = 'web'),
    'organicSessions', (select coalesce(sum(sessions), 0) from public.seo_ga4_landing_daily where metric_date >= since_date and medium = 'organic'),
    'organicSignups', (select coalesce(sum(signups), 0) from public.seo_ga4_landing_daily where metric_date >= since_date and medium = 'organic'),
    'organicPurchases', (select coalesce(sum(purchases), 0) from public.seo_ga4_landing_daily where metric_date >= since_date and medium = 'organic'),
    'organicRevenue', (select coalesce(sum(revenue), 0) from public.seo_ga4_landing_daily where metric_date >= since_date and medium = 'organic'),
    'bingClicks', (select coalesce(sum(clicks), 0) from public.seo_bing_page_daily where metric_date >= since_date),
    'openAlerts', (select count(*) from public.seo_alerts where status in ('open', 'acknowledged'))
  );
$$;

alter table public.seo_touchpoints enable row level security;
alter table public.seo_user_attribution enable row level security;
alter table public.seo_gsc_page_daily enable row level security;
alter table public.seo_gsc_query_page_daily enable row level security;
alter table public.seo_ga4_landing_daily enable row level security;
alter table public.seo_bing_page_daily enable row level security;
alter table public.seo_url_state enable row level security;
alter table public.seo_crawl_runs enable row level security;
alter table public.seo_crawl_snapshots enable row level security;
alter table public.seo_link_edges enable row level security;
alter table public.seo_quality_snapshots enable row level security;
alter table public.seo_job_runs enable row level security;
alter table public.seo_job_state enable row level security;
alter table public.seo_alerts enable row level security;
alter table public.seo_automation_config enable row level security;

revoke all on public.seo_touchpoints, public.seo_user_attribution,
  public.seo_gsc_page_daily, public.seo_gsc_query_page_daily,
  public.seo_ga4_landing_daily, public.seo_bing_page_daily,
  public.seo_url_state, public.seo_crawl_runs, public.seo_crawl_snapshots,
  public.seo_link_edges, public.seo_quality_snapshots, public.seo_job_runs,
  public.seo_job_state, public.seo_alerts, public.seo_automation_config
  from anon, authenticated;

grant select, insert, update, delete on public.seo_touchpoints, public.seo_user_attribution,
  public.seo_gsc_page_daily, public.seo_gsc_query_page_daily,
  public.seo_ga4_landing_daily, public.seo_bing_page_daily,
  public.seo_url_state, public.seo_crawl_runs, public.seo_crawl_snapshots,
  public.seo_link_edges, public.seo_quality_snapshots, public.seo_job_runs,
  public.seo_job_state, public.seo_alerts, public.seo_automation_config
  to service_role;

revoke all on function public.get_seo_dashboard_summary(date) from public, anon, authenticated;
grant execute on function public.get_seo_dashboard_summary(date) to service_role;

commit;
