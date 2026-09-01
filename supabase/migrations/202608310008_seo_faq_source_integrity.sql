begin;

-- Drafts use human-readable source keys so an editor can audit a citation
-- before ingest. The persisted page body must use the actual seo_sources UUIDs
-- so FAQ citations remain referentially valid after the draft file is gone.
alter table public.seo_sources
  add column if not exists source_key text;

alter table public.seo_sources
  drop constraint if exists seo_sources_source_key_length;

alter table public.seo_sources
  add constraint seo_sources_source_key_length
  check (source_key is null or char_length(source_key) between 1 and 160);

create unique index if not exists seo_sources_page_source_key_idx
  on public.seo_sources (page_id, source_key)
  where source_key is not null;

-- Preserve the already-reviewed legacy implementation under a private name,
-- then wrap it with the source-key reconciliation transaction. This keeps all
-- existing page, rights, generation, and link checks intact while making the
-- citation rewrite atomic for both local ingest and signed callbacks.
do $rename$
begin
  if to_regprocedure('public.ingest_seo_page_draft(jsonb)') is not null
     and to_regprocedure('public.ingest_seo_page_draft_legacy(jsonb)') is null then
    alter function public.ingest_seo_page_draft(jsonb)
      rename to ingest_seo_page_draft_legacy;
  end if;
end;
$rename$;

create or replace function public.ingest_seo_page_draft(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
#variable_conflict use_variable
declare
  v_page_id uuid;
  v_source_id uuid;
  v_source_key text;
  v_source_url text;
  v_source_item jsonb;
  v_faq_item jsonb;
  v_faq_ref text;
  v_faqs jsonb := '[]'::jsonb;
  v_resolved_refs jsonb;
  v_source_map jsonb := '{}'::jsonb;
  v_body jsonb;
begin
  -- The legacy function performs the complete validated ingest and returns
  -- the new non-live page. Any failure below rolls the whole call back.
  v_page_id := public.ingest_seo_page_draft_legacy(payload);

  if jsonb_typeof(payload->'sources') <> 'array'
     or coalesce(jsonb_array_length(payload->'sources'), 0) < 1 then
    raise exception 'SEO draft requires source records for FAQ citation mapping.';
  end if;

  for v_source_item in select value from jsonb_array_elements(payload->'sources') loop
    v_source_key := nullif(btrim(coalesce(
      v_source_item->>'id',
      v_source_item->>'sourceKey',
      case when jsonb_typeof(v_source_item->'claimsSupported') = 'array'
        then v_source_item->'claimsSupported'->>0
        else null
      end,
      ''
    )), '');
    v_source_url := nullif(btrim(v_source_item->>'url'), '');
    if v_source_key is null or v_source_url is null then
      raise exception 'SEO source records require a stable id/sourceKey and URL.';
    end if;
    if v_source_map ? v_source_key then
      raise exception 'SEO source stable IDs must be unique within a draft.';
    end if;

    select s.id
      into v_source_id
      from public.seo_sources as s
     where s.page_id = v_page_id
       and s.url = v_source_url
     limit 1;
    if v_source_id is null then
      raise exception 'SEO source row was not persisted for URL %.', v_source_url;
    end if;

    update public.seo_sources
       set source_key = v_source_key
     where id = v_source_id;
    v_source_map := jsonb_set(v_source_map, array[v_source_key], to_jsonb(v_source_id), true);
  end loop;

  select p.body
    into v_body
    from public.seo_pages as p
   where p.id = v_page_id
   for update;
  if v_body is null then
    raise exception 'SEO page body was not persisted for FAQ citation mapping.';
  end if;

  if jsonb_typeof(v_body->'faqs') <> 'array' then
    raise exception 'SEO draft FAQs must be an array for citation mapping.';
  end if;

  for v_faq_item in select value from jsonb_array_elements(v_body->'faqs') loop
    if jsonb_typeof(v_faq_item->'evidenceSourceIds') <> 'array'
       or coalesce(jsonb_array_length(v_faq_item->'evidenceSourceIds'), 0) = 0 then
      raise exception 'Each SEO FAQ requires at least one evidence source.';
    end if;
    v_resolved_refs := '[]'::jsonb;
    for v_faq_ref in select jsonb_array_elements_text(v_faq_item->'evidenceSourceIds') loop
      if not (v_source_map ? v_faq_ref) then
        raise exception 'SEO FAQ references unknown source key %.', v_faq_ref;
      end if;
      v_resolved_refs := v_resolved_refs || jsonb_build_array(v_source_map->>v_faq_ref);
    end loop;
    v_faq_item := jsonb_set(v_faq_item, '{evidenceSourceIds}', v_resolved_refs, true);
    v_faqs := v_faqs || jsonb_build_array(v_faq_item);
  end loop;

  update public.seo_pages
     set body = jsonb_set(v_body, '{faqs}', v_faqs, true),
         updated_at = now()
   where id = v_page_id;

  return v_page_id;
end;
$$;

revoke all on function public.ingest_seo_page_draft(jsonb) from public, anon, authenticated;
grant execute on function public.ingest_seo_page_draft(jsonb) to service_role;
revoke all on function public.ingest_seo_page_draft_legacy(jsonb) from public, anon, authenticated;
grant execute on function public.ingest_seo_page_draft_legacy(jsonb) to service_role;

comment on function public.ingest_seo_page_draft(jsonb) is
  'Atomically imports a validated non-live SEO draft and rewrites FAQ source keys to persisted source UUIDs; service-role only.';

commit;
