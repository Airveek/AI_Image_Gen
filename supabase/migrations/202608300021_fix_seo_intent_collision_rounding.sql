begin;

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
         greatest(0::numeric, least(1::numeric, (1 - (content_embedding <=> embedding))::numeric)) as similarity
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
      'similarity', round(nearest_page.similarity::numeric, 6)
    );
  end if;
  if nearest_page.similarity >= 0.85 then
    return jsonb_build_object(
      'status', 'merge_review',
      'reason', 'embedding_similarity_between_0_85_and_0_92',
      'pageId', nearest_page.id,
      'path', nearest_page.path,
      'similarity', round(nearest_page.similarity::numeric, 6)
    );
  end if;
  return jsonb_build_object(
    'status', 'clear',
    'reason', 'embedding_similarity_below_0_85',
    'similarity', round(nearest_page.similarity::numeric, 6)
  );
end;
$$;

revoke all on function public.check_seo_intent_collision(text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.check_seo_intent_collision(text, text, text, text, uuid) to service_role;

commit;
