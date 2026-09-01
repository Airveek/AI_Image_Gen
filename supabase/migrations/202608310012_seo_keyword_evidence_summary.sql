begin;

-- Keep keyword feedback visible to operators without loading the raw evidence
-- table into the dashboard or an agent process. The detailed rows remain
-- queryable for a bounded brief handoff; this RPC is the aggregate control
-- plane view used for freshness and coverage checks.
create or replace function public.get_seo_keyword_evidence_summary(since_date date)
returns jsonb
language sql
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'generatedAt', now(),
    'sinceDate', since_date,
    'totalRows', (select count(*) from public.seo_keyword_evidence where metric_date >= since_date),
    'measuredRows', (select count(*) from public.seo_keyword_evidence where metric_date >= since_date and source in ('gsc', 'bing', 'keyword_planner')),
    'qualitativeRows', (select count(*) from public.seo_keyword_evidence where metric_date >= since_date and source in ('serp', 'reddit', 'youtube', 'social', 'competitor', 'manual')),
    'linkedRows', (select count(*) from public.seo_keyword_evidence where metric_date >= since_date and (page_id is not null or topic_id is not null or brief_id is not null)),
    'latestMetricDate', (select max(metric_date) from public.seo_keyword_evidence),
    'sources', coalesce((
      select jsonb_agg(jsonb_build_object('source', source, 'rows', row_count) order by source)
      from (
        select source, count(*) as row_count
        from public.seo_keyword_evidence
        where metric_date >= since_date
        group by source
      ) grouped
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.get_seo_keyword_evidence_summary(date) from public, anon, authenticated;
grant execute on function public.get_seo_keyword_evidence_summary(date) to service_role;

comment on function public.get_seo_keyword_evidence_summary(date) is
  'Bounded aggregate of keyword/query evidence freshness and source coverage; never a page-publishing instruction.';

commit;
