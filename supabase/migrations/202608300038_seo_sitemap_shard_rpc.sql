begin;

-- Sitemap responses must remain bounded as the public catalog grows. The
-- application asks the database for shard descriptors and one 2,000-URL
-- shard at a time instead of loading the entire live catalog into a route.
create index if not exists seo_pages_sitemap_path_idx
  on public.seo_pages (page_family, path)
  where status = 'live' and noindex = false and canonical_page_id is null;

create index if not exists seo_url_state_sitemap_eligible_idx
  on public.seo_url_state (eligible_for_indexing, last_http_status, page_id)
  where eligible_for_indexing = true and last_http_status = 200;

create or replace function public.get_seo_sitemap_shard_index(p_shard_size integer default 2000)
returns table(
  slug text,
  family text,
  month text,
  shard_index integer,
  url_count bigint,
  lastmod timestamptz
)
language sql
security definer
set search_path = ''
stable
as $$
  with settings as (
    select greatest(1, least(coalesce(p_shard_size, 2000), 50000))::bigint as shard_size
  ), eligible as (
    select
      case p.page_family
        when 'product-hub' then 'product-hubs'
        when 'category-hub' then 'category-hubs'
        when 'listing' then 'listing-images'
        when 'lifestyle' then 'lifestyle-images'
        when 'detail' then 'detail-images'
        when 'prompt' then 'product-photo-prompts'
        when 'tutorial' then 'tutorials'
        when 'feature' then 'features'
        else 'content'
      end as family,
      to_char(date_trunc('month', coalesce(p.search_lastmod_at, p.published_at)), 'YYYY-MM') as month,
      coalesce(p.search_lastmod_at, p.published_at) as lastmod
    from public.seo_pages p
    join public.seo_url_state u on u.page_id = p.id
    where p.status = 'live'
      and p.noindex = false
      and p.canonical_page_id is null
      and u.eligible_for_indexing = true
      and u.last_http_status = 200
  ), grouped as (
    select family, month, count(*)::bigint as total_count, max(lastmod) as lastmod
    from eligible
    group by family, month
  )
  select
    grouped.family || '-' || grouped.month || '-' || shard.shard_index::text as slug,
    grouped.family,
    grouped.month,
    shard.shard_index,
    least(settings.shard_size, grouped.total_count - ((shard.shard_index - 1)::bigint * settings.shard_size))::bigint as url_count,
    grouped.lastmod
  from grouped
  cross join settings
  cross join lateral generate_series(
    1,
    ceil(grouped.total_count::numeric / settings.shard_size)::integer
  ) as shard(shard_index)
  order by grouped.family, grouped.month, shard.shard_index;
$$;

create or replace function public.get_seo_sitemap_shard(
  p_family text,
  p_month text,
  p_shard_index integer,
  p_shard_size integer default 2000
)
returns table(path text, lastmod timestamptz)
language sql
security definer
set search_path = ''
stable
as $$
  with settings as (
    select
      greatest(1, least(coalesce(p_shard_size, 2000), 50000))::bigint as shard_size,
      case p_family
        when 'product-hubs' then 'product-hub'
        when 'category-hubs' then 'category-hub'
        when 'listing-images' then 'listing'
        when 'lifestyle-images' then 'lifestyle'
        when 'detail-images' then 'detail'
        when 'product-photo-prompts' then 'prompt'
        when 'tutorials' then 'tutorial'
        when 'features' then 'feature'
        else p_family
      end as page_family
  ), bounds as (
    select
      to_date(p_month || '-01', 'YYYY-MM-DD')::timestamptz as start_at,
      (to_date(p_month || '-01', 'YYYY-MM-DD') + interval '1 month')::timestamptz as end_at
  ), eligible as (
    select p.path, coalesce(p.search_lastmod_at, p.published_at) as lastmod
    from public.seo_pages p
    join public.seo_url_state u on u.page_id = p.id
    cross join settings
    cross join bounds
    where p.status = 'live'
      and p.noindex = false
      and p.canonical_page_id is null
      and u.eligible_for_indexing = true
      and u.last_http_status = 200
      and p.page_family = settings.page_family
      and p_month ~ '^[0-9]{4}-[0-9]{2}$'
      and p_shard_index is not null
      and p_shard_index > 0
      and (
        (p.search_lastmod_at is not null and p.search_lastmod_at >= bounds.start_at and p.search_lastmod_at < bounds.end_at)
        or (p.search_lastmod_at is null and p.published_at >= bounds.start_at and p.published_at < bounds.end_at)
      )
  ), numbered as (
    select eligible.path, eligible.lastmod,
      row_number() over (order by eligible.path) as ordinal
    from eligible
  )
  select numbered.path, numbered.lastmod
  from numbered
  cross join settings
  where numbered.ordinal > ((greatest(p_shard_index, 1) - 1)::bigint * settings.shard_size)
    and numbered.ordinal <= (greatest(p_shard_index, 1)::bigint * settings.shard_size)
  order by numbered.path;
$$;

revoke all on function public.get_seo_sitemap_shard_index(integer) from public, anon, authenticated;
revoke all on function public.get_seo_sitemap_shard(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.get_seo_sitemap_shard_index(integer) to service_role;
grant execute on function public.get_seo_sitemap_shard(text, text, integer, integer) to service_role;

commit;
