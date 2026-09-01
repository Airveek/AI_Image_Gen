begin;

-- Durable handoffs make the content agent a resumable worker rather than an
-- in-memory side effect of a cron invocation. A dispatch never makes a page
-- live; the existing evidence, editor, and publish gates remain authoritative.
create table if not exists public.seo_agent_runs (
  id uuid primary key default gen_random_uuid(),
  brief_id uuid not null references public.seo_content_briefs(id) on delete restrict,
  assignment_id uuid references public.seo_content_assignments(id) on delete set null,
  page_id uuid references public.seo_pages(id) on delete set null,
  dispatch_key text not null unique check (char_length(dispatch_key) between 16 and 240),
  agent_kind text not null default 'airveek-seo-content' check (char_length(agent_kind) between 3 and 80),
  request_checksum text not null check (request_checksum ~ '^[a-f0-9]{64}$'),
  draft_checksum text check (draft_checksum is null or draft_checksum ~ '^[a-f0-9]{64}$'),
  external_run_id text check (external_run_id is null or char_length(external_run_id) between 1 and 240),
  status text not null default 'queued' check (status in ('queued', 'sent', 'accepted', 'processing', 'completed', 'failed', 'expired', 'cancelled')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error text check (last_error is null or char_length(last_error) <= 4_000),
  response_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(response_metadata) = 'object'),
  sent_at timestamptz,
  accepted_at timestamptz,
  completed_at timestamptz,
  received_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists seo_agent_runs_brief_created_idx
  on public.seo_agent_runs (brief_id, created_at desc);
create index if not exists seo_agent_runs_status_updated_idx
  on public.seo_agent_runs (status, updated_at desc);
create index if not exists seo_agent_runs_assignment_idx
  on public.seo_agent_runs (assignment_id, created_at desc)
  where assignment_id is not null;
create index if not exists seo_agent_runs_page_idx
  on public.seo_agent_runs (page_id, created_at desc)
  where page_id is not null;

alter table public.seo_agent_runs enable row level security;
revoke all on public.seo_agent_runs from anon, authenticated;
grant select, insert, update on public.seo_agent_runs to service_role;

drop trigger if exists seo_agent_runs_updated_at on public.seo_agent_runs;
create trigger seo_agent_runs_updated_at
before update on public.seo_agent_runs
for each row execute function public.set_seo_updated_at();

comment on table public.seo_agent_runs is
  'Idempotent signed handoffs to an external SEO content agent; completion creates a non-live draft only.';
comment on column public.seo_agent_runs.dispatch_key is
  'Stable brief/version key used to prevent duplicate agent work across retries.';
comment on column public.seo_agent_runs.request_checksum is
  'SHA-256 checksum of the exact request envelope sent to the agent.';

commit;
