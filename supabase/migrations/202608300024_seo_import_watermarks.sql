begin;

-- One durable watermark per measurement provider. The source workers may
-- safely replay a metric day (all fact tables use idempotent upserts), while
-- this table makes the attempted/successful range explicit and lets a later
-- run resume a short gap after a transient provider failure.
create table if not exists public.seo_import_watermarks (
  source text primary key check (source in ('gsc', 'ga4', 'bing')),
  status text not null default 'idle' check (status in ('idle', 'running', 'succeeded', 'failed')),
  last_attempted_metric_date date,
  last_success_metric_date date,
  last_attempted_at timestamptz,
  last_success_at timestamptz,
  last_error text check (last_error is null or char_length(last_error) <= 4_000),
  cursor jsonb not null default '{}'::jsonb check (jsonb_typeof(cursor) = 'object'),
  updated_at timestamptz not null default now()
);

insert into public.seo_import_watermarks (source)
values ('gsc'), ('ga4'), ('bing')
on conflict (source) do nothing;

create index if not exists seo_import_watermarks_success_idx
  on public.seo_import_watermarks (last_success_metric_date desc);

alter table public.seo_import_watermarks enable row level security;
revoke all on public.seo_import_watermarks from anon, authenticated;
grant select, insert, update on public.seo_import_watermarks to service_role;

comment on table public.seo_import_watermarks is
  'Resumable per-provider SEO measurement import state; fact rows remain idempotent upserts.';
comment on column public.seo_import_watermarks.last_success_metric_date is
  'Latest metric day fully imported for this provider. Failed attempts never advance it.';

commit;
