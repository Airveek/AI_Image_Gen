begin;

-- A failed queued->sent transition must not strand an active queued run. The
-- recovery heartbeat may safely expire and requeue queued runs because no
-- external request is sent until the durable `sent` state is confirmed.
create or replace function public.recover_seo_agent_run(
  p_run_id uuid,
  p_expected_status text,
  p_cutoff timestamptz,
  p_requeue boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  run_row record;
  recovery_status text;
  next_brief_status text;
  message text;
  recovered_at timestamptz := now();
begin
  if p_expected_status not in ('queued', 'sent', 'accepted', 'processing') then
    raise exception 'Invalid SEO agent recovery status.';
  end if;

  select id, brief_id, assignment_id, status
    into run_row
    from public.seo_agent_runs
   where id = p_run_id
     and status = p_expected_status
     and updated_at < p_cutoff
   for update;

  if not found then
    return jsonb_build_object('status', 'raced');
  end if;

  recovery_status := case when p_requeue and p_expected_status in ('queued', 'sent') then 'requeued' else 'blocked' end;
  next_brief_status := case when recovery_status = 'requeued' then 'assigned' else 'blocked' end;
  message := case
    when recovery_status = 'requeued' and p_expected_status = 'queued'
      then 'The content-agent handoff never reached the durable sent state; it was expired and returned to the assigned queue without an external request.'
    when recovery_status = 'requeued'
      then 'The content-agent handoff was not accepted within 30 minutes; it was expired and returned to the assigned queue.'
    else 'The content-agent handoff stopped progressing for 6 hours after acceptance; it was expired and blocked for manual review to prevent duplicate work.'
  end;

  update public.seo_agent_runs
     set status = 'expired',
         last_error = message,
         completed_at = recovered_at,
         received_at = recovered_at,
         updated_at = recovered_at
   where id = run_row.id;

  if run_row.assignment_id is not null then
    update public.seo_content_assignments
       set status = next_brief_status,
           started_at = case when recovery_status = 'requeued' then null else started_at end,
           notes = message,
           updated_at = recovered_at
     where id = run_row.assignment_id
       and status in ('assigned', 'accepted', 'in_progress');
  end if;

  update public.seo_content_briefs
     set status = next_brief_status,
         updated_at = recovered_at
   where id = run_row.brief_id
     and status in ('ready_for_assignment', 'assigned', 'in_progress');

  insert into public.seo_content_audit_events (
    entity_type, entity_id, action, to_status, request_id, metadata, occurred_at
  ) values (
    'brief',
    run_row.brief_id,
    'agent.expired',
    next_brief_status,
    left('agent-expired:' || run_row.id::text, 180),
    jsonb_build_object('agentRunId', run_row.id, 'priorStatus', p_expected_status, 'recovery', recovery_status),
    recovered_at
  );

  return jsonb_build_object('status', recovery_status, 'briefId', run_row.brief_id);
end;
$$;

revoke all on function public.recover_seo_agent_run(uuid, text, timestamptz, boolean) from public, anon, authenticated;
grant execute on function public.recover_seo_agent_run(uuid, text, timestamptz, boolean) to service_role;

comment on function public.recover_seo_agent_run(uuid, text, timestamptz, boolean) is
  'Atomically expires stale queued or sent SEO agent handoffs for safe requeue, and blocks accepted/processing runs for review.';

commit;
