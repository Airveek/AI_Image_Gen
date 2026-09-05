-- Durable, non-secret recovery signals for the owner-operated Gemini bridge.
-- Raw browser cookies must never be stored in Supabase. The local worker reads
-- the job, obtains fresh values from an explicitly configured Chrome profile,
-- and sends them only to the private bridge management endpoint.

begin;
create table if not exists public.provider_account_recovery_jobs (
  id uuid primary key default gen_random_uuid(),
  account_id text not null check (account_id ~ '^[A-Za-z0-9_-]{1,80}$'),
  reason text not null check (char_length(reason) between 1 and 500),
  source_trace_id text check (source_trace_id is null or char_length(source_trace_id) between 1 and 120),
  status text not null default 'queued' check (status in ('queued', 'processing', 'succeeded', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  last_error text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists provider_account_recovery_active
  on public.provider_account_recovery_jobs (account_id)
  where status in ('queued', 'processing');
create index if not exists provider_account_recovery_queue
  on public.provider_account_recovery_jobs (status, available_at, created_at);
alter table public.provider_account_recovery_jobs enable row level security;
revoke all on public.provider_account_recovery_jobs from anon, authenticated;
comment on table public.provider_account_recovery_jobs is
  'Non-secret signals asking the owner-operated local worker to refresh one Gemini bridge account.';
comment on column public.provider_account_recovery_jobs.account_id is
  'Opaque account id returned by the private Gemini bridge; never a cookie value.';
commit;
