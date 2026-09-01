begin;

-- A resolved collision is a human exception to an existing merge review, not
-- a general bypass flag. Require the prior merge-review state and its target
-- page to remain attached before allowing an approval/live transition.
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
  if tg_op = 'UPDATE'
     and old.intent_collision_status in ('merge_review', 'resolved')
     and new.locale is not distinct from old.locale
     and new.product_slug is not distinct from old.product_slug
     and new.normalized_intent_key is not distinct from old.normalized_intent_key
     and new.content_embedding is not distinct from old.content_embedding
     and new.intent_collision_status = 'resolved'
     and new.intent_collision_page_id is not null
     and char_length(trim(coalesce(new.intent_collision_note, ''))) >= 20
     and new.status in ('approved', 'scheduled', 'publishing', 'live') then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and new.locale is not distinct from old.locale
     and new.product_slug is not distinct from old.product_slug
     and new.normalized_intent_key is not distinct from old.normalized_intent_key
     and new.content_embedding is not distinct from old.content_embedding
     and new.status is not distinct from old.status
     and new.intent_collision_status is not distinct from old.intent_collision_status
     and new.intent_collision_note is not distinct from old.intent_collision_note then
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
    new.intent_collision_note := null;
  end if;
  return new;
end;
$$;

drop trigger if exists seo_pages_intent_collision_guard on public.seo_pages;
create trigger seo_pages_intent_collision_guard
before insert or update of status, locale, product_slug, normalized_intent_key, content_embedding, intent_collision_status, intent_collision_note
on public.seo_pages
for each row execute function public.guard_seo_intent_collision();

revoke all on function public.guard_seo_intent_collision() from public, anon, authenticated;

comment on function public.guard_seo_intent_collision() is
  'Rechecks semantic intent on approval/live transitions; only a prior merge-review record with a documented note may be resolved.';

commit;
