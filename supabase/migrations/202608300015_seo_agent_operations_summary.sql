begin;

-- Keep agent handoff health in the aggregate-only admin view. The dashboard
-- never needs to load the potentially large seo_agent_runs table directly.
create or replace function public.get_seo_operations_summary()
returns jsonb
language sql
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'generatedAt', now(),
    'briefsByStatus', coalesce((
      select jsonb_object_agg(status, total)
      from (
        select status, count(*)::integer as total
        from public.seo_content_briefs
        group by status
      ) grouped_briefs
    ), '{}'::jsonb),
    'activeAssignments', (
      select count(*)::integer
      from public.seo_content_assignments
      where status not in ('completed', 'reassigned', 'cancelled')
    ),
    'reviewQueue', (
      select count(*)::integer
      from public.seo_content_briefs
      where status in ('editor_review', 'changes_requested')
    ),
    'evidenceQueue', (
      select count(*)::integer
      from public.seo_evidence_packets
      where status = 'submitted'
    ),
    'auditEvents', (
      select count(*)::integer
      from public.seo_content_audit_events
    ),
    'agentRunsByStatus', coalesce((
      select jsonb_object_agg(status, total)
      from (
        select status, count(*)::integer as total
        from public.seo_agent_runs
        group by status
      ) grouped_agent_runs
    ), '{}'::jsonb),
    'activeAgentRuns', (
      select count(*)::integer
      from public.seo_agent_runs
      where status in ('queued', 'sent', 'accepted', 'processing')
    ),
    'expiredAgentRuns', (
      select count(*)::integer
      from public.seo_agent_runs
      where status = 'expired'
    ),
    'failedAgentRuns', (
      select count(*)::integer
      from public.seo_agent_runs
      where status = 'failed'
    )
  );
$$;

revoke all on function public.get_seo_operations_summary() from public, anon, authenticated;
grant execute on function public.get_seo_operations_summary() to service_role;

commit;
