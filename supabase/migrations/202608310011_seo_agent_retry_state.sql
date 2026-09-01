begin;

-- Failed content-agent handoffs need a typed cooldown. A transient provider
-- failure can be retried by the five-minute dispatcher after the cooldown;
-- rights, policy, malformed-input, and editorial failures remain manual.
alter table public.seo_agent_runs
  add column if not exists retry_class text
    check (retry_class is null or retry_class in ('transient_provider', 'manual_review'));
alter table public.seo_agent_runs
  add column if not exists next_attempt_at timestamptz;

create index if not exists seo_agent_runs_retry_idx
  on public.seo_agent_runs (status, next_attempt_at, updated_at)
  where status = 'failed' and next_attempt_at is not null;

comment on column public.seo_agent_runs.retry_class is
  'Typed failure class. transient_provider may be retried after next_attempt_at; manual_review must be resolved by a human.';
comment on column public.seo_agent_runs.next_attempt_at is
  'Earliest timestamp at which a failed transient handoff may be dispatched again.';

commit;
