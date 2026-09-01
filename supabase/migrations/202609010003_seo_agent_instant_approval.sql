begin;

-- The owner-operated/content-agent worker may automatically record the
-- editorial approval once its deterministic draft contract and database
-- ingest checks have passed. Keep this as an explicit database switch so it
-- can be paused without a schema rewrite. It never makes a page live.
alter table public.seo_automation_config
  add column if not exists instant_agent_approval_enabled boolean not null default false;

comment on column public.seo_automation_config.instant_agent_approval_enabled is
  'When true, a completed SEO agent run may atomically move its passing non-live draft to approved. Publishing, indexability, redirects, merges, pruning, and canonical changes remain separately gated.';

create or replace function public.auto_approve_seo_agent_draft(
  p_run_id uuid,
  p_page_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
volatile
as $$
declare
  run_row record;
  page_row record;
  brief_row record;
  quality_row record;
  config_row record;
  decision_id uuid;
  resolved_page_id uuid;
  existing_decision boolean;
  blockers text[] := '{}';
begin
  if p_run_id is null then
    return jsonb_build_object('approved', false, 'reason', 'run_id_missing');
  end if;

  select enabled, instant_agent_approval_enabled
    into config_row
    from public.seo_automation_config
   where id = true;
  if not found or config_row.enabled is not true or config_row.instant_agent_approval_enabled is not true then
    return jsonb_build_object('approved', false, 'reason', 'instant_agent_approval_disabled');
  end if;

  select id, brief_id, page_id, status
    into run_row
    from public.seo_agent_runs
   where id = p_run_id
   for update;
  if not found then
    return jsonb_build_object('approved', false, 'reason', 'agent_run_not_found');
  end if;
  if run_row.status not in ('processing', 'completed') then
    return jsonb_build_object('approved', false, 'reason', 'agent_run_not_complete', 'status', run_row.status);
  end if;

  resolved_page_id := coalesce(p_page_id, run_row.page_id);
  if resolved_page_id is null then
    select page_id into resolved_page_id
      from public.seo_content_briefs
     where id = run_row.brief_id;
  end if;
  if resolved_page_id is null or (run_row.page_id is not null and run_row.page_id <> resolved_page_id) then
    return jsonb_build_object('approved', false, 'reason', 'agent_page_link_missing');
  end if;

  select id, status, noindex, author_id, reviewer_id, quality_score,
         template_version, intent_collision_status, path
    into page_row
    from public.seo_pages
   where id = resolved_page_id
   for update;
  if not found then
    return jsonb_build_object('approved', false, 'reason', 'page_not_found');
  end if;

  select id, page_id, status
    into brief_row
    from public.seo_content_briefs
   where id = run_row.brief_id
   for update;
  if not found or (brief_row.page_id is not null and brief_row.page_id <> resolved_page_id) then
    return jsonb_build_object('approved', false, 'reason', 'brief_page_link_missing');
  end if;

  if page_row.status = 'approved' then
    return jsonb_build_object('approved', true, 'duplicate', true, 'pageId', resolved_page_id);
  end if;
  if page_row.status not in ('draft', 'automated_qa', 'editor_review', 'changes_requested', 'refresh') or page_row.noindex is not true then
    return jsonb_build_object('approved', false, 'reason', 'page_not_in_private_review_state', 'status', page_row.status);
  end if;

  select status, score, blockers
    into quality_row
    from public.seo_quality_runs
   where page_id = resolved_page_id
   order by created_at desc
   limit 1;
  if not found or quality_row.status <> 'pass' or coalesce(quality_row.score, 0) < 85 then
    blockers := array_append(blockers, 'quality_check_not_passing');
  end if;
  if found and coalesce(cardinality(quality_row.blockers), 0) > 0 then
    blockers := blockers || quality_row.blockers;
  end if;
  if page_row.author_id is null then blockers := array_append(blockers, 'author_missing'); end if;
  if page_row.reviewer_id is null then blockers := array_append(blockers, 'reviewer_missing'); end if;
  if page_row.quality_score is null or page_row.quality_score < 85 then blockers := array_append(blockers, 'quality_score_below_85'); end if;
  if coalesce(page_row.intent_collision_status, 'clear') not in ('clear', 'resolved') then blockers := array_append(blockers, 'intent_collision_requires_review'); end if;
  if not exists (
    select 1 from public.content_members cm
     where cm.user_id = page_row.reviewer_id
       and cm.is_active = true
       and cm.role in ('editor', 'publisher', 'seo_admin')
  ) then blockers := array_append(blockers, 'reviewer_not_active_editor'); end if;

  if cardinality(blockers) > 0 then
    return jsonb_build_object('approved', false, 'reason', 'agent_draft_checks_failed', 'pageId', resolved_page_id, 'blockers', blockers);
  end if;

  select exists(
    select 1
      from public.seo_review_decisions rd
     where rd.page_id = resolved_page_id
       and rd.review_type = 'editorial'
       and rd.decision = 'approved'
       and coalesce(rd.checklist->>'approvalMode', '') = 'instant_agent'
  ) into existing_decision;

  if not existing_decision then
    insert into public.seo_review_decisions (
      brief_id, page_id, review_type, decision, content_version, reviewer_id,
      score, checklist, blockers, notes
    ) values (
      run_row.brief_id, resolved_page_id, 'editorial', 'approved',
      page_row.template_version, page_row.reviewer_id, page_row.quality_score,
      jsonb_build_object(
        'approvalMode', 'instant_agent',
        'agentRunId', p_run_id,
        'deterministicChecks', true,
        'technicalAndContentGatesPassed', true
      ), '{}',
      'Automatically approved after the Airveek content-agent draft passed deterministic contract, quality, intent, and persistence checks.'
    ) returning id into decision_id;
  end if;

  update public.seo_pages
     set status = 'approved', noindex = true, updated_at = now()
   where id = resolved_page_id
     and status <> 'live';

  update public.seo_content_briefs
     set status = 'approved', page_id = resolved_page_id,
         approved_at = coalesce(approved_at, now()), updated_at = now()
   where id = run_row.brief_id;

  insert into public.seo_content_audit_events (
    entity_type, entity_id, actor_id, from_status, to_status, action,
    request_id, metadata
  ) values (
    'brief', run_row.brief_id, page_row.reviewer_id, brief_row.status,
    'approved', 'agent.auto_approved', p_run_id::text,
    jsonb_build_object('pageId', resolved_page_id, 'approvalMode', 'instant_agent', 'decisionId', decision_id)
  );

  return jsonb_build_object('approved', true, 'duplicate', existing_decision, 'pageId', resolved_page_id, 'decisionId', decision_id);
end;
$$;

revoke all on function public.auto_approve_seo_agent_draft(uuid, uuid) from public, anon, authenticated;
grant execute on function public.auto_approve_seo_agent_draft(uuid, uuid) to service_role;

comment on function public.auto_approve_seo_agent_draft(uuid, uuid) is
  'Atomically records instant editorial approval for a completed Airveek SEO agent draft after deterministic checks. It never publishes or changes indexability.';

commit;
