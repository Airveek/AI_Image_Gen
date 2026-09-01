begin;

-- Extend the aggregate dashboard without exposing raw performance samples.
create or replace function public.get_seo_dashboard_summary(since_date date)
returns jsonb
language sql
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'generatedAt', now(),
    'publishedUrls', (select count(*) from public.seo_url_state where first_published_at is not null),
    'crawlableUrls', (select count(*) from public.seo_url_state where eligible_for_indexing and last_http_status = 200 and coalesce(last_robots_directive, '') not ilike '%noindex%'),
    'verifiedIndexedUrls', (select count(*) from public.seo_url_state where google_inspection_verdict in ('PASS', 'VERDICT_PASS', 'indexed')),
    'impressionActiveUrls', (select count(distinct canonical_url) from public.seo_gsc_page_daily where metric_date >= since_date and country = 'all' and device = 'all' and search_type = 'web' and impressions > 0),
    'googleClicks', (select coalesce(sum(clicks), 0) from public.seo_gsc_page_daily where metric_date >= since_date and country = 'all' and device = 'all' and search_type = 'web'),
    'googleImpressions', (select coalesce(sum(impressions), 0) from public.seo_gsc_page_daily where metric_date >= since_date and country = 'all' and device = 'all' and search_type = 'web'),
    'organicSessions', (select coalesce(sum(sessions), 0) from public.seo_ga4_landing_daily where metric_date >= since_date and medium = 'organic'),
    'organicSignups', (select coalesce(sum(signups), 0) from public.seo_ga4_landing_daily where metric_date >= since_date and medium = 'organic'),
    'organicPurchases', (select coalesce(sum(purchases), 0) from public.seo_ga4_landing_daily where metric_date >= since_date and medium = 'organic'),
    'organicRevenue', (select coalesce(sum(revenue), 0) from public.seo_ga4_landing_daily where metric_date >= since_date and medium = 'organic'),
    'bingClicks', (select coalesce(sum(clicks), 0) from public.seo_bing_page_daily where metric_date >= since_date),
    'openAlerts', (select count(*) from public.seo_alerts where status in ('open', 'acknowledged')),
    'coreWebVitals', coalesce((
      select jsonb_object_agg(metric_name, jsonb_build_object('p75', p75, 'sampleCount', sample_count))
      from (
        select metric_name,
               percentile_cont(0.75) within group (order by value) as p75,
               count(*)::integer as sample_count
        from public.seo_web_vitals
        where occurred_at >= since_date
        group by metric_name
      ) vitals
    ), '{}'::jsonb)
  );
$$;

revoke all on function public.get_seo_dashboard_summary(date) from public, anon, authenticated;
grant execute on function public.get_seo_dashboard_summary(date) to service_role;

commit;
