begin;

create or replace function public.get_seo_web_vitals_summary(since_date date)
returns jsonb
language sql
security invoker
set search_path = public
as $$
  select coalesce(jsonb_object_agg(metric_name, jsonb_build_object('p75', p75, 'sampleCount', sample_count)), '{}'::jsonb)
  from (
    select metric_name,
           percentile_cont(0.75) within group (order by value) as p75,
           count(*)::integer as sample_count
    from public.seo_web_vitals
    where occurred_at >= since_date
    group by metric_name
  ) vitals;
$$;

revoke all on function public.get_seo_web_vitals_summary(date) from public, anon, authenticated;
grant execute on function public.get_seo_web_vitals_summary(date) to service_role;

comment on function public.get_seo_web_vitals_summary(date) is
  'Aggregate P75 Core Web Vitals for operations health; raw samples remain service-role only.';

commit;
