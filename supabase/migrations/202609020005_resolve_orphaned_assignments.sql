begin;
-- A previous timeout left one assignment marked blocked even though its brief
-- was already approved. Close that stale queue record so the operations view
-- reflects the actual page state and contains no manual-review dead end.
with stale as (
  select a.id, a.brief_id, a.status as from_status
  from public.seo_content_assignments a
  join public.seo_content_briefs b on b.id = a.brief_id
  where a.status = 'blocked'
    and b.status in ('approved', 'submitted')
)
update public.seo_content_assignments a
set status = 'completed',
    completed_at = coalesce(a.completed_at, now()),
    notes = 'Automatically closed after the linked brief was approved; no manual-review action required.',
    updated_at = now()
from stale s
where a.id = s.id;
insert into public.seo_content_audit_events (
  entity_type, entity_id, action, from_status, to_status, request_id, metadata, occurred_at
)
select
  'assignment',
  a.id,
  'assignment.autopilot.closed',
  'blocked',
  'completed',
  a.id::text,
  jsonb_build_object('reason', 'linked_brief_already_approved'),
  now()
from public.seo_content_assignments a
join public.seo_content_briefs b on b.id = a.brief_id
where a.status = 'completed'
  and a.notes = 'Automatically closed after the linked brief was approved; no manual-review action required.';
commit;
