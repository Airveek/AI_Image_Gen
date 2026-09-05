begin;
-- Requeue the pages that the first automatic wave returned solely because a
-- draft pointed at future/nonexistent detail URLs. Stable public hubs are
-- valid crawl targets, so repair those edges and let the normal publisher
-- re-run the complete render and quality gate. Historical batch/quality rows
-- remain untouched.
with latest_quality as (
  select distinct on (page_id)
    page_id,
    status,
    blockers
  from public.seo_quality_runs
  order by page_id, created_at desc
), eligible_pages as (
  select p.id, p.path
  from public.seo_pages p
  join latest_quality q on q.page_id = p.id
  where p.status = 'changes_requested'
    and q.status = 'fail'
    and q.blockers = array['related_internal_links_missing']::text[]
)
insert into public.seo_link_edges (
  source_page_id,
  source_url,
  target_page_id,
  target_url,
  anchor_text,
  placement,
  nofollow
)
select
  p.id,
  'https://airveek.com' || p.path,
  null,
  'https://airveek.com' || links.target_path,
  links.anchor_text,
  'related',
  false
from eligible_pages p
cross join (values
  ('/product-photography/', 'Browse product photography guides'),
  ('/product-photo-prompts/', 'Browse tested product photo prompts'),
  ('/tutorials/', 'Learn the product photo workflow'),
  ('/features/', 'Explore Airveek image tools')
) as links(target_path, anchor_text)
on conflict (source_url, target_url, anchor_text, placement)
do update set
  source_page_id = excluded.source_page_id,
  nofollow = false,
  last_seen_at = now();
with latest_quality as (
  select distinct on (page_id)
    page_id,
    status,
    blockers
  from public.seo_quality_runs
  order by page_id, created_at desc
)
update public.seo_pages p
set status = 'approved',
    noindex = true,
    updated_at = now()
from latest_quality q
where q.page_id = p.id
  and p.status = 'changes_requested'
  and q.status = 'fail'
  and q.blockers = array['related_internal_links_missing']::text[];
commit;
