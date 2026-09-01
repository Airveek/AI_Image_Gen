begin;

-- Keep dispatch keys unique while work is active, but allow a terminal
-- failed/expired run to be retried with the same stable brief/version key.
-- Terminal rows remain immutable history; only one queued/sent/accepted/
-- processing handoff may exist for a key at a time.
alter table public.seo_agent_runs
  drop constraint if exists seo_agent_runs_dispatch_key_key;

create unique index if not exists seo_agent_runs_active_dispatch_key_idx
  on public.seo_agent_runs (dispatch_key)
  where status in ('queued', 'sent', 'accepted', 'processing');

comment on index public.seo_agent_runs_active_dispatch_key_idx is
  'Prevents duplicate active handoffs while allowing safe retries after a terminal run state.';

commit;
