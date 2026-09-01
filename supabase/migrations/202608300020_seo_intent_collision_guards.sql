begin;

-- Semantic similarity is an internal publishing control, not a Google ranking
-- rule. Exact normalized intent remains the first line of defence; embeddings
-- add a deterministic review boundary when a writer supplies one.
alter table public.seo_pages
  add column if not exists intent_collision_status text not null default 'clear',
  add column if not exists intent_collision_page_id uuid references public.seo_pages(id) on delete set null,
  add column if not exists intent_collision_similarity numeric(8,6),
  add column if not exists intent_collision_note text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'seo_pages_intent_collision_status_check'
      and conrelid = 'public.seo_pages'::regclass
  ) then
    alter table public.seo_pages
      add constraint seo_pages_intent_collision_status_check
      check (intent_collision_status in ('clear', 'merge_review', 'resolved'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'seo_pages_intent_collision_similarity_check'
      and conrelid = 'public.seo_pages'::regclass
  ) then
    alter table public.seo_pages
      add constraint seo_pages_intent_collision_similarity_check
      check (intent_collision_similarity is null or (intent_collision_similarity >= 0 and intent_collision_similarity <= 1));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'seo_pages_intent_collision_resolution_check'
      and conrelid = 'public.seo_pages'::regclass
  ) then
    alter table public.seo_pages
      add constraint seo_pages_intent_collision_resolution_check
      check (intent_collision_status <> 'resolved' or char_length(trim(coalesce(intent_collision_note, ''))) >= 20);
  end if;
end;
$$;

create index if not exists seo_pages_intent_collision_review_idx
  on public.seo_pages (intent_collision_status, updated_at desc)
  where intent_collision_status = 'merge_review';

create or replace function public.check_seo_intent_collision(
  p_normalized_intent_key text,
  p_locale text default 'en',
  p_product_slug text default null,
  p_embedding text default null,
  p_exclude_page_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  locale_key text := coalesce(nullif(trim(p_locale), ''), 'en');
  intent_key text := lower(trim(coalesce(p_normalized_intent_key, '')));
  product_key text := nullif(lower(trim(coalesce(p_product_slug, ''))), '');
  embedding extensions.vector(1536);
  exact_page record;
  nearest_page record;
begin
  if intent_key = '' or intent_key !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'SEO collision check requires a normalized slug intent key.';
  end if;

  if nullif(trim(coalesce(p_embedding, '')), '') is not null then
    begin
      embedding := trim(p_embedding)::extensions.vector(1536);
    exception when others then
      raise exception 'SEO content embedding must be a valid 1536-dimensional vector.';
    end;
  end if;

  select id, path, normalized_intent_key, product_slug
    into exact_page
    from public.seo_pages
   where locale = locale_key
     and normalized_intent_key = intent_key
     and status not in ('merged', 'archived')
     and (p_exclude_page_id is null or id <> p_exclude_page_id)
   order by created_at asc
   limit 1;

  if exact_page.id is not null then
    return jsonb_build_object(
      'status', 'blocked',
      'reason', 'exact_normalized_intent',
      'pageId', exact_page.id,
      'path', exact_page.path,
      'similarity', 1
    );
  end if;

  if embedding is null or product_key is null then
    return jsonb_build_object('status', 'clear', 'reason', 'no_comparable_embedding');
  end if;

  select id, path, normalized_intent_key,
         greatest(0::numeric, least(1::numeric, 1 - (content_embedding <=> embedding))) as similarity
    into nearest_page
    from public.seo_pages
   where locale = locale_key
     and product_slug = product_key
     and status not in ('merged', 'archived')
     and content_embedding is not null
     and (p_exclude_page_id is null or id <> p_exclude_page_id)
   order by content_embedding <=> embedding asc
   limit 1;

  if nearest_page.id is null then
    return jsonb_build_object('status', 'clear', 'reason', 'no_comparable_embedding');
  end if;
  if nearest_page.similarity >= 0.92 then
    return jsonb_build_object(
      'status', 'blocked',
      'reason', 'embedding_similarity_at_or_above_0_92',
      'pageId', nearest_page.id,
      'path', nearest_page.path,
      'similarity', round(nearest_page.similarity, 6)
    );
  end if;
  if nearest_page.similarity >= 0.85 then
    return jsonb_build_object(
      'status', 'merge_review',
      'reason', 'embedding_similarity_between_0_85_and_0_92',
      'pageId', nearest_page.id,
      'path', nearest_page.path,
      'similarity', round(nearest_page.similarity, 6)
    );
  end if;
  return jsonb_build_object(
    'status', 'clear',
    'reason', 'embedding_similarity_below_0_85',
    'similarity', round(nearest_page.similarity, 6)
  );
end;
$$;

-- This is callable only by the trusted ingest/agent workers. Public and
-- authenticated clients must not use it to enumerate existing page paths.
revoke all on function public.check_seo_intent_collision(text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.check_seo_intent_collision(text, text, text, text, uuid) to service_role;

create or replace function public.guard_seo_intent_collision()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  collision jsonb;
  collision_status text;
begin
  -- Avoid re-evaluating an unchanged embedding while an editor resolves a
  -- documented merge review. Any identity/embedding change is checked again.
  if tg_op = 'UPDATE'
     and new.locale is not distinct from old.locale
     and new.product_slug is not distinct from old.product_slug
     and new.normalized_intent_key is not distinct from old.normalized_intent_key
     and new.content_embedding is not distinct from old.content_embedding then
    return new;
  end if;

  collision := public.check_seo_intent_collision(
    p_normalized_intent_key => new.normalized_intent_key,
    p_locale => new.locale,
    p_product_slug => new.product_slug,
    p_embedding => case when new.content_embedding is null then null else new.content_embedding::text end,
    p_exclude_page_id => new.id
  );
  collision_status := coalesce(collision->>'status', 'clear');

  if collision_status = 'blocked' then
    raise exception 'SEO intent collision blocked (%). Existing page: % (similarity %).',
      coalesce(collision->>'reason', 'unknown'),
      coalesce(collision->>'path', collision->>'pageId', 'unknown'),
      coalesce(collision->>'similarity', 'unknown');
  end if;

  if collision_status = 'merge_review' then
    if new.status in ('approved', 'scheduled', 'publishing', 'live') then
      raise exception 'SEO intent collision requires merge review before approval or publication (similarity %).', collision->>'similarity';
    end if;
    new.intent_collision_status := 'merge_review';
    new.intent_collision_page_id := nullif(collision->>'pageId', '')::uuid;
    new.intent_collision_similarity := nullif(collision->>'similarity', '')::numeric;
    new.intent_collision_note := null;
    if new.status in ('idea', 'assigned', 'draft', 'automated_qa') then
      new.status := 'editor_review';
      new.noindex := true;
    end if;
  else
    new.intent_collision_status := 'clear';
    new.intent_collision_page_id := null;
    new.intent_collision_similarity := null;
    if new.intent_collision_status <> 'resolved' then
      new.intent_collision_note := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists seo_pages_intent_collision_guard on public.seo_pages;
create trigger seo_pages_intent_collision_guard
before insert or update of locale, product_slug, normalized_intent_key, content_embedding
on public.seo_pages
for each row execute function public.guard_seo_intent_collision();

revoke all on function public.guard_seo_intent_collision() from public, anon, authenticated;

comment on column public.seo_pages.intent_collision_status is
  'Internal semantic-intent control: clear, merge_review, or editor-resolved.';
comment on function public.check_seo_intent_collision(text, text, text, text, uuid) is
  'Service-role preflight for exact intent and embedding similarity thresholds; 0.92 blocks and 0.85-0.92 requires merge review.';

commit;
