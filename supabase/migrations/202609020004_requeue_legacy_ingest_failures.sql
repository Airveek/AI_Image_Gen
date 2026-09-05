begin;
-- Older local-agent runs stored the short literal `draft_ingest_failed`
-- without the diagnostic suffix. Treat those records the same as the newer
-- detailed form so they do not remain stranded in manual review.
create temporary table _seo_legacy_ingest_requeue on commit drop as
with latest_runs as (
  select distinct on (brief_id)
    brief_id,
    id as run_id,
    last_error
  from public.seo_agent_runs
  order by brief_id, created_at desc
)
select
  b.id as brief_id,
  r.run_id,
  a.id as assignment_id,
  coalesce(r.last_error, '') as last_error
from public.seo_content_briefs b
join latest_runs r on r.brief_id = b.id
left join lateral (
  select id
  from public.seo_content_assignments
  where brief_id = b.id
    and assignment_role = 'writer'
  order by updated_at desc
  limit 1
) a on true
where b.status = 'blocked'
  and r.last_error ilike 'draft_ingest_failed%';
update public.seo_content_assignments a
set status = 'assigned',
    notes = 'Autopilot requeued a legacy ingest failure; no human manual-review hold.',
    updated_at = now()
from _seo_legacy_ingest_requeue c
where a.id = c.assignment_id
  and a.status = 'blocked';
update public.seo_content_briefs b
set status = case when c.assignment_id is null then 'ready_for_assignment' else 'assigned' end,
    updated_at = now()
from _seo_legacy_ingest_requeue c
where b.id = c.brief_id
  and b.status = 'blocked';
update public.seo_agent_runs r
set retry_class = 'transient_provider',
    next_attempt_at = now(),
    updated_at = now()
from _seo_legacy_ingest_requeue c
where r.id = c.run_id
  and r.status = 'failed';
insert into public.seo_content_audit_events (
  entity_type, entity_id, action, to_status, request_id, metadata, occurred_at
)
select
  'brief',
  c.brief_id,
  'agent.autopilot.requeued',
  case when c.assignment_id is null then 'ready_for_assignment' else 'assigned' end,
  coalesce(c.run_id::text, c.brief_id::text),
  jsonb_build_object('reason', 'legacy_draft_ingest_failure', 'previousError', left(c.last_error, 1000)),
  now()
from _seo_legacy_ingest_requeue c;
commit;
