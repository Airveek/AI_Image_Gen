begin;

-- Reader-first mode removes ownership/evidence approval as a publishing
-- prerequisite while retaining the columns for historical audit data and an
-- operator-controlled rollback path.
alter table public.seo_automation_config
  add column if not exists reader_first_mode boolean not null default true,
  add column if not exists evidence_gates_enabled boolean not null default false;

update public.seo_automation_config
   set reader_first_mode = true,
       evidence_gates_enabled = false
 where id = true;

drop trigger if exists seo_topics_rights_evidence on public.seo_topics;
drop trigger if exists seo_generation_runs_rights_evidence on public.seo_generation_runs;
drop trigger if exists seo_assets_rights_evidence on public.seo_assets;
drop trigger if exists seo_evidence_items_rights_checksum on public.seo_evidence_items;

-- Existing rows retain their recorded values. New assets may be unreviewed in
-- reader-first mode; technical media integrity remains enforced by the
-- application validator and this checksum/dimensions contract.
alter table public.seo_assets
  drop constraint if exists seo_assets_rights_status_check;
alter table public.seo_assets
  add constraint seo_assets_rights_status_check
  check (rights_status in ('unreviewed', 'approved', 'restricted', 'rejected'));
alter table public.seo_assets
  alter column rights_status set default 'unreviewed';

alter table public.seo_topics
  drop constraint if exists seo_topics_rights_evidence_array_check;

alter table public.seo_evidence_packets
  drop constraint if exists seo_evidence_packets_rights_status_check;
alter table public.seo_evidence_packets
  add constraint seo_evidence_packets_rights_status_check
  check (rights_status in ('unreviewed', 'approved', 'restricted', 'rejected'));

alter table public.seo_evidence_items
  drop constraint if exists seo_evidence_items_rights_status_check;
alter table public.seo_evidence_items
  add constraint seo_evidence_items_rights_status_check
  check (rights_status in ('unreviewed', 'approved', 'restricted', 'rejected'));

-- The function is intentionally separate from the legacy evidence-enforced
-- RPC. This lets an operator restore the previous path by setting the feature
-- flag and environment variable without deleting historical data.
create or replace function public.ingest_seo_page_draft_reader_first(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
#variable_conflict use_variable
declare
  v_page_id uuid;
  v_topic_id uuid;
  v_author_id uuid;
  v_reviewer_id uuid;
  v_locale text := coalesce(nullif(payload->>'locale', ''), 'en');
  v_page_family text := payload->>'pageFamily';
  v_status text := coalesce(nullif(payload->>'status', ''), 'draft');
  v_raw_path text := payload->>'path';
  v_path text;
  v_page_slug text;
  v_product_slug text;
  v_job_slug text;
  v_intent_key text := payload->>'intentKey';
  v_normalized_intent_key text;
  v_topic_kind text;
  v_topic_slug text;
  v_quality_score integer;
  v_content_body jsonb;
  v_run jsonb;
  v_media jsonb;
  v_source jsonb;
  v_link jsonb;
  v_run_id uuid;
  v_asset_id uuid;
  v_target_page_id uuid;
  v_external_id text;
  v_run_map jsonb := '{}'::jsonb;
  v_asset_map jsonb := '{}'::jsonb;
  v_source_map jsonb := '{}'::jsonb;
  v_source_key text;
  v_source_id uuid;
  v_faq jsonb;
  v_faqs jsonb := '[]'::jsonb;
  v_link_path text;
  v_link_type text;
  v_asset_role text;
  v_rights_status text;
  v_logo_policy text;
  v_media_checksum text;
  v_media_url text;
  v_mime_type text;
  v_width integer;
  v_height integer;
  v_qa_status text;
begin
  if jsonb_typeof(payload) <> 'object' then
    raise exception 'SEO draft must be a JSON object.';
  end if;
  if coalesce(v_page_family, '') not in ('product-hub', 'category-hub', 'listing', 'lifestyle', 'detail', 'prompt', 'tutorial', 'feature') then
    raise exception 'SEO draft pageFamily is invalid.';
  end if;
  if v_status not in ('draft', 'automated_qa', 'editor_review', 'changes_requested', 'refresh') then
    raise exception 'SEO draft status must be a non-approved review state.';
  end if;
  if v_raw_path is null or v_raw_path = '' or v_raw_path ~ '[?&#%]|//' then
    raise exception 'SEO draft path must be a clean crawlable path.';
  end if;
  v_path := case when v_raw_path = '/' then '/' else '/' || trim(both '/' from v_raw_path) || '/' end;
  if v_path !~ '^/[a-z0-9][a-z0-9/_-]*\/?$' then
    raise exception 'SEO draft path contains unsupported characters.';
  end if;
  v_page_slug := regexp_replace(trim(both '/' from v_path), '^.*/', '');
  v_product_slug := lower(regexp_replace(regexp_replace(coalesce(payload->>'productEntity', ''), '[^a-zA-Z0-9]+', '-', 'g'), '(^-|-$)', '', 'g'));
  if v_product_slug = '' then raise exception 'SEO draft productEntity is required.'; end if;
  v_topic_slug := v_product_slug;
  v_normalized_intent_key := lower(regexp_replace(regexp_replace(coalesce(v_intent_key, ''), '[^a-zA-Z0-9]+', '-', 'g'), '(^-|-$)', '', 'g'));
  if v_normalized_intent_key = '' then raise exception 'SEO draft intentKey is required.'; end if;
  v_job_slug := lower(regexp_replace(regexp_replace(coalesce(payload->'content'->>'jobSlug', v_page_slug), '[^a-zA-Z0-9]+', '-', 'g'), '(^-|-$)', '', 'g'));

  begin
    v_author_id := nullif(payload->'author'->>'id', '')::uuid;
    v_reviewer_id := nullif(payload->'reviewer'->>'id', '')::uuid;
  exception when invalid_text_representation then
    raise exception 'SEO draft author and reviewer IDs must be UUIDs.';
  end;
  if v_author_id is null or v_reviewer_id is null then
    raise exception 'SEO draft requires author and reviewer IDs.';
  end if;
  if not exists (select 1 from public.content_members where user_id = v_author_id and is_active = true)
     or not exists (select 1 from public.content_members where user_id = v_reviewer_id and is_active = true) then
    raise exception 'SEO draft author and reviewer must be active content members.';
  end if;

  if jsonb_typeof(payload->'media') <> 'array' or coalesce(jsonb_array_length(payload->'media'), 0) < 1 then
    raise exception 'SEO draft requires at least one media record.';
  end if;
  if jsonb_typeof(payload->'sources') <> 'array' or coalesce(jsonb_array_length(payload->'sources'), 0) < 1 then
    raise exception 'SEO draft requires at least one source record.';
  end if;
  if jsonb_typeof(payload->'links') <> 'object'
     or jsonb_typeof(payload->'links'->'inbound') <> 'array'
     or coalesce(jsonb_array_length(payload->'links'->'inbound'), 0) < 2
     or jsonb_typeof(payload->'links'->'outbound') <> 'array'
     or coalesce(jsonb_array_length(payload->'links'->'outbound'), 0) < 4 then
    raise exception 'SEO draft requires at least two inbound and four outbound links.';
  end if;
  if exists (select 1 from public.seo_pages where path = v_path) then
    raise exception 'SEO draft path already exists; use the review/update workflow instead of replacing it.';
  end if;

  v_topic_kind := case when v_page_family in ('feature', 'tutorial') then v_page_family when v_page_family = 'category-hub' then 'category' else 'product' end;
  insert into public.seo_topics (locale, kind, name, slug, buyer_questions, demand_evidence, rights_status, status, created_by)
  values (v_locale, v_topic_kind, left(coalesce(payload->>'productEntity', v_topic_slug), 160), v_topic_slug,
          jsonb_build_array(coalesce(payload->>'buyerQuestion', '')), coalesce(payload->'demandEvidence', '[]'::jsonb), 'unreviewed', 'approved', v_author_id)
  on conflict (locale, kind, slug) do update set
    buyer_questions = excluded.buyer_questions,
    demand_evidence = excluded.demand_evidence,
    updated_at = now()
  returning id into v_topic_id;

  v_page_id := case when (payload->>'pageId') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$' then (payload->>'pageId')::uuid else gen_random_uuid() end;
  v_quality_score := case when (payload->>'qualityScore') ~ '^[0-9]+$' then (payload->>'qualityScore')::integer else null end;
  if v_quality_score is null or v_quality_score < 85 or v_quality_score > 100 then raise exception 'SEO draft qualityScore must be between 85 and 100.'; end if;
  if jsonb_typeof(payload->'qualityChecks') <> 'object' or coalesce(payload->'qualityChecks'->>'status', '') <> 'pass' then raise exception 'SEO draft must include a passing deterministic validation result.'; end if;
  v_content_body := coalesce(payload->'content', '{}'::jsonb) || jsonb_build_object('buyerQuestion', payload->>'buyerQuestion');
  insert into public.seo_pages (id, topic_id, locale, page_family, status, path, slug, product_slug, job_slug, title, meta_title, meta_description, direct_answer, primary_query, primary_intent, normalized_intent_key, body, author_id, reviewer_id, template_version, cohort_id, quality_score, noindex)
  values (v_page_id, v_topic_id, v_locale, v_page_family, v_status, v_path, v_page_slug, v_product_slug, nullif(v_job_slug, ''), left(coalesce(payload->>'title', v_page_slug), 180), left(coalesce(payload->>'metaTitle', payload->>'title', v_page_slug), 180), left(coalesce(payload->>'metaDescription', ''), 320), left(coalesce(payload->>'directAnswer', ''), 1000), left(coalesce(payload->>'primaryQuery', payload->>'buyerQuestion', v_intent_key), 240), left(coalesce(payload->>'primaryIntent', v_intent_key), 500), v_normalized_intent_key, v_content_body, v_author_id, v_reviewer_id, left(coalesce(payload->>'templateVersion', 'seo-v2-reader-first'), 40), nullif(left(payload->>'cohortId', 80), ''), v_quality_score, true);
  insert into public.seo_quality_runs (page_id, gate_version, status, score, checks, blockers) values (v_page_id, 'draft-validator-reader-first-v1', 'pass', v_quality_score, payload->'qualityChecks', '{}');

  for v_run in select value from jsonb_array_elements(coalesce(payload->'generationRuns', '[]'::jsonb)) loop
    if coalesce(v_run->>'creatorRoute', '') like '/create/%'
       and coalesce(v_run->>'prompt', '') <> ''
       and coalesce(v_run->>'kitChecksum', '') ~ '^[a-fA-F0-9]{64}$' then
      v_run_id := gen_random_uuid();
      v_external_id := nullif(v_run->>'runId', '');
      if v_external_id is not null then v_run_map := jsonb_set(v_run_map, array[v_external_id], to_jsonb(v_run_id), true); end if;
      insert into public.seo_generation_runs (id, topic_id, opportunity_id, image_job, creator_asset_id, creator_route, arena_id, source_asset, settings, prompt, negative_constraints, kit_path, kit_checksum, qa_status, qa_summary, recorded_at, created_by, provider, model, output_manifest)
      values (v_run_id, v_topic_id, nullif(v_run->>'opportunityId', ''), coalesce(nullif(v_run->>'imageJob', ''), 'prompt'), case when (v_run->>'creatorAssetId') ~ '^[0-9a-fA-F-]{36}$' then (v_run->>'creatorAssetId')::uuid else null end, v_run->>'creatorRoute', left(coalesce(v_run->>'arenaId', 'product'), 120), coalesce(v_run->'sourceAsset', '{}'::jsonb), case when jsonb_typeof(v_run->'settings') = 'object' then v_run->'settings' else '{}'::jsonb end, left(v_run->>'prompt', 12000), case when jsonb_typeof(v_run->'negativeConstraints') = 'array' then array(select jsonb_array_elements_text(v_run->'negativeConstraints')) else '{}' end, nullif(v_run->>'kitPath', ''), lower(v_run->>'kitChecksum'), case when v_run->>'qaStatus' in ('pass', 'fail', 'superseded') then v_run->>'qaStatus' else 'pending' end, case when jsonb_typeof(v_run->'qaSummary') = 'object' then v_run->'qaSummary' else '{}'::jsonb end, case when nullif(v_run->>'recordedAt', '') is null then null else (v_run->>'recordedAt')::timestamptz end, v_author_id, nullif(v_run->>'provider', ''), nullif(v_run->>'model', ''), coalesce(v_run->'outputs', '[]'::jsonb));
      insert into public.seo_page_generation_runs (page_id, generation_run_id, evidence_role) values (v_page_id, v_run_id, case when v_run->>'imageJob' in ('listing', 'lifestyle', 'detail') then 'primary' else 'supporting' end);
    end if;
  end loop;

  for v_media in select value from jsonb_array_elements(payload->'media') loop
    v_media_url := nullif(v_media->>'url', '');
    v_media_checksum := regexp_replace(lower(coalesce(v_media->>'checksum', '')), '^sha256:', '');
    v_width := nullif(v_media->>'width', '')::integer;
    v_height := nullif(v_media->>'height', '')::integer;
    if v_media_url is null or v_media_url !~ '^https://' or v_media_checksum !~ '^[a-f0-9]{64}$' or coalesce(v_width, 0) < 320 or coalesce(v_height, 0) < 320 or coalesce(v_media->>'alt', '') = '' then
      raise exception 'SEO media record is missing a durable URL, checksum, dimensions, or alt text.';
    end if;
    v_asset_id := gen_random_uuid();
    v_external_id := nullif(v_media->>'assetId', '');
    if v_external_id is not null then v_asset_map := jsonb_set(v_asset_map, array[v_external_id], to_jsonb(v_asset_id), true); end if;
    v_asset_role := coalesce(nullif(v_media->>'role', ''), 'selected');
    if v_asset_role not in ('source', 'hero', 'selected', 'rejected', 'corrected', 'screenshot', 'video', 'og') then raise exception 'SEO media role is invalid.'; end if;
    v_rights_status := case when v_media->>'rightsStatus' in ('approved', 'restricted', 'rejected') then v_media->>'rightsStatus' else 'unreviewed' end;
    v_logo_policy := coalesce(nullif(v_media->>'logoPolicy', ''), 'unverified_brand');
    v_mime_type := coalesce(nullif(v_media->>'mimeType', ''), 'image/webp');
    if v_mime_type not in ('image/png', 'image/jpeg', 'image/webp', 'video/mp4', 'video/webm') then v_mime_type := 'image/webp'; end if;
    v_qa_status := case when v_media->>'qaStatus' in ('pass', 'fail') then v_media->>'qaStatus' else 'pending' end;
    insert into public.seo_assets (id, page_id, generation_run_id, role, public_url, storage_key, checksum, mime_type, width, height, alt_text, caption, provenance, rights_status, qa_status, ai_provenance, generation_metadata, logo_policy)
    values (v_asset_id, v_page_id, case when (v_media->>'generationRunId') is not null and v_run_map ? (v_media->>'generationRunId') then (v_run_map->>(v_media->>'generationRunId'))::uuid else null end, v_asset_role, v_media_url, coalesce(nullif(v_media->>'storageKey', ''), format('seo/%s/%s', v_page_id, v_asset_id)), v_media_checksum, v_mime_type, v_width, v_height, left(v_media->>'alt', 500), left(v_media->>'caption', 1000), left(coalesce(v_media->>'provenance', 'Airveek reader-first media'), 1000), v_rights_status, v_qa_status, nullif(v_media->>'aiProvenance', ''), coalesce(v_media->'generationMetadata', '{}'::jsonb) || jsonb_build_object('externalAssetId', v_external_id), v_logo_policy);
  end loop;

  for v_source in select value from jsonb_array_elements(payload->'sources') loop
    if coalesce(v_source->>'url', '') !~ '^https://' or coalesce(v_source->>'title', '') = '' or coalesce(v_source->>'accessedAt', '') = '' then raise exception 'SEO source record is missing HTTPS URL, title, or accessedAt.'; end if;
    v_source_key := nullif(btrim(coalesce(v_source->>'id', v_source->>'sourceKey', '')), '');
    insert into public.seo_sources (page_id, title, url, publisher, claim_ids, accessed_at, review_after, source_key)
    values (v_page_id, left(v_source->>'title', 300), v_source->>'url', nullif(left(v_source->>'publisher', 300), ''), case when jsonb_typeof(v_source->'claimsSupported') = 'array' then array(select jsonb_array_elements_text(v_source->'claimsSupported')) else '{}' end, (v_source->>'accessedAt')::timestamptz, case when nullif(v_source->>'reviewAfter', '') is null then null else (v_source->>'reviewAfter')::timestamptz end, v_source_key)
    on conflict on constraint seo_sources_page_id_url_key do update set title = excluded.title, publisher = excluded.publisher, claim_ids = excluded.claim_ids, accessed_at = excluded.accessed_at, review_after = excluded.review_after, source_key = excluded.source_key
    returning id into v_source_id;
    if v_source_key is not null then v_source_map := jsonb_set(v_source_map, array[v_source_key], to_jsonb(v_source_id), true); end if;
  end loop;

  if jsonb_typeof(v_content_body->'faqs') = 'array' then
    for v_faq in select value from jsonb_array_elements(v_content_body->'faqs') loop
      if jsonb_typeof(v_faq->'evidenceSourceIds') = 'array' then
        v_faq := jsonb_set(v_faq, '{evidenceSourceIds}', coalesce((select jsonb_agg(v_source_map->>ref) from jsonb_array_elements_text(v_faq->'evidenceSourceIds') as ref where v_source_map ? ref), '[]'::jsonb), true);
      end if;
      v_faqs := v_faqs || jsonb_build_array(v_faq);
    end loop;
    v_content_body := jsonb_set(v_content_body, '{faqs}', v_faqs, true);
    update public.seo_pages set body = v_content_body, updated_at = now() where id = v_page_id;
  end if;

  for v_link in select value from jsonb_array_elements(payload->'links'->'inbound') loop
    v_link_path := case when v_link->>'path' = '/' then '/' else '/' || trim(both '/' from v_link->>'path') || '/' end;
    if v_link_path !~ '^/[a-z0-9][a-z0-9/_-]*\/?$' or coalesce(v_link->>'anchor', '') = '' then raise exception 'SEO inbound link is invalid.'; end if;
    insert into public.seo_link_edges (source_page_id, source_url, target_page_id, target_url, anchor_text, placement, nofollow) values (null, 'https://airveek.com' || v_link_path, v_page_id, 'https://airveek.com' || v_path, left(v_link->>'anchor', 240), 'navigation', false) on conflict (source_url, target_url, anchor_text, placement) do update set last_seen_at = now();
    select id into v_target_page_id from public.seo_pages where path = v_link_path and status not in ('merged', 'archived');
    if v_target_page_id is not null then insert into public.seo_links (source_page_id, target_page_id, link_type, anchor_text) values (v_target_page_id, v_page_id, 'related', left(v_link->>'anchor', 240)) on conflict on constraint seo_links_source_page_id_target_page_id_link_type_key do update set anchor_text = excluded.anchor_text, updated_at = now(); end if;
  end loop;
  for v_link in select value from jsonb_array_elements(payload->'links'->'outbound') loop
    v_link_path := case when v_link->>'path' = '/' then '/' else '/' || trim(both '/' from v_link->>'path') || '/' end;
    if v_link_path !~ '^/[a-z0-9][a-z0-9/_-]*\/?$' or coalesce(v_link->>'anchor', '') = '' then raise exception 'SEO outbound link is invalid.'; end if;
    v_link_type := case when v_link_path like '/tutorials/%' then 'tutorial' when v_link_path like '/features/%' then 'feature' when v_link_path like '/product-photo-prompts/%' then 'prompt' else 'related' end;
    insert into public.seo_link_edges (source_page_id, source_url, target_page_id, target_url, anchor_text, placement, nofollow) values (v_page_id, 'https://airveek.com' || v_path, null, 'https://airveek.com' || v_link_path, left(v_link->>'anchor', 240), 'body', false) on conflict (source_url, target_url, anchor_text, placement) do update set last_seen_at = now();
    select id into v_target_page_id from public.seo_pages where path = v_link_path and status not in ('merged', 'archived');
    if v_target_page_id is not null then insert into public.seo_links (source_page_id, target_page_id, link_type, anchor_text) values (v_page_id, v_target_page_id, v_link_type, left(v_link->>'anchor', 240)) on conflict on constraint seo_links_source_page_id_target_page_id_link_type_key do update set anchor_text = excluded.anchor_text, updated_at = now(); end if;
  end loop;
  return v_page_id;
end;
$$;

revoke all on function public.ingest_seo_page_draft_reader_first(jsonb) from public, anon, authenticated;
grant execute on function public.ingest_seo_page_draft_reader_first(jsonb) to service_role;

comment on function public.ingest_seo_page_draft_reader_first(jsonb) is
  'Atomically imports a reader-first non-live SEO draft without ownership/evidence approval gates; technical media, content, link, author, and quality requirements remain enforced. Service-role only.';

commit;
