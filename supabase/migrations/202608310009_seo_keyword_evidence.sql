begin;

-- Search demand is a reusable research input, not just a dashboard number.
-- Keep provider facts separate from briefs so writers can see what query/page
-- pairs actually earned impressions before proposing a sibling intent.
create table if not exists public.seo_keyword_evidence (
  id uuid primary key default gen_random_uuid(),
  page_id uuid references public.seo_pages(id) on delete set null,
  topic_id uuid references public.seo_topics(id) on delete set null,
  brief_id uuid references public.seo_content_briefs(id) on delete set null,
  source text not null check (source in ('gsc', 'bing', 'keyword_planner', 'serp', 'reddit', 'youtube', 'social', 'competitor', 'manual')),
  query text not null check (char_length(query) between 1 and 500),
  canonical_url text not null default '' check (canonical_url = '' or canonical_url ~ '^https://'),
  metric_date date not null,
  country text not null default 'all' check (char_length(country) between 1 and 32),
  device text not null default 'all' check (char_length(device) between 1 and 32),
  search_type text not null default 'web' check (char_length(search_type) between 1 and 32),
  clicks bigint not null default 0 check (clicks >= 0),
  impressions bigint not null default 0 check (impressions >= 0),
  ctr numeric(10, 8) check (ctr is null or ctr between 0 and 1),
  position numeric(10, 4) check (position is null or position >= 0),
  volume bigint check (volume is null or volume >= 0),
  competition numeric(10, 4) check (competition is null or competition between 0 and 1),
  source_url text check (source_url is null or source_url ~ '^https://'),
  source_title text check (source_title is null or char_length(source_title) <= 500),
  confidence smallint not null default 100 check (confidence between 0 and 100),
  evidence_key text not null unique check (evidence_key ~ '^[a-f0-9]{64}$'),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  collected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, metric_date, query, canonical_url, country, device, search_type)
);

create index if not exists seo_keyword_evidence_page_date_idx
  on public.seo_keyword_evidence (page_id, metric_date desc, impressions desc)
  where page_id is not null;
create index if not exists seo_keyword_evidence_query_date_idx
  on public.seo_keyword_evidence (query, metric_date desc, impressions desc);
create index if not exists seo_keyword_evidence_source_date_idx
  on public.seo_keyword_evidence (source, metric_date desc);

drop trigger if exists seo_keyword_evidence_updated_at on public.seo_keyword_evidence;
create trigger seo_keyword_evidence_updated_at
  before update on public.seo_keyword_evidence
  for each row execute function public.set_seo_updated_at();

alter table public.seo_keyword_evidence enable row level security;

create policy "Content members can read keyword evidence"
  on public.seo_keyword_evidence for select to authenticated
  using (public.is_active_content_member());

create policy "Brief leads can manage keyword evidence"
  on public.seo_keyword_evidence for all to authenticated
  using (public.can_brief_seo_content())
  with check (public.can_brief_seo_content());

revoke all on public.seo_keyword_evidence from anon;
grant select, insert, update, delete on public.seo_keyword_evidence to authenticated;
grant all on public.seo_keyword_evidence to service_role;

comment on table public.seo_keyword_evidence is
  'Auditable keyword/query evidence from GSC, Bing, planner, SERP, community, competitor, or manual research. Provider facts are reusable inputs, not automatic publishing instructions.';
comment on column public.seo_keyword_evidence.evidence_key is
  'Stable SHA-256 key for the source/date/query/page/dimension tuple; imports are idempotent.';

commit;
