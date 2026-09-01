begin;

-- The content agent writes one validated contract at a time. Keeping the
-- mapping in a single transaction prevents half a page (or orphaned evidence)
-- from entering the publishing queue when any record is malformed.
create or replace function public.ingest_seo_page_draft(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
#variable_conflict use_variable
declare
  page_id uuid;
  existing_page_id uuid;
  topic_id uuid;
  author_id uuid;
  reviewer_id uuid;
  v_locale text := coalesce(nullif(payload->>'locale', ''), 'en');
  page_family text := payload->>'pageFamily';
  page_status text := coalesce(nullif(payload->>'status', ''), 'draft');
  raw_path text := payload->>'path';
  normalized_path text;
  page_slug text;
  product_slug text;
  job_slug text;
  intent_key text := payload->>'intentKey';
  normalized_intent_key text;
  topic_kind text;
  topic_slug text;
  run jsonb;
  media_item jsonb;
  source_item jsonb;
  link_item jsonb;
  run_id uuid;
  asset_id uuid;
  target_page_id uuid;
  external_id text;
  asset_map jsonb := '{}'::jsonb;
  run_map jsonb := '{}'::jsonb;
  image_jobs text[] := '{}'::text[];
  image_job text;
  run_qa_failed boolean := false;
  asset_role text;
  has_source_asset boolean := false;
  has_selected_asset boolean := false;
  rights_status text;
  logo_policy text;
  media_checksum text;
  media_url text;
  link_path text;
  link_type text;
  quality_score integer;
  content_body jsonb;
begin
  -- EXECUTE is revoked from public, anon, and authenticated below; only the
  -- service role (plus trusted database owners) can invoke this function.
  if jsonb_typeof(payload) <> 'object' then
    raise exception 'SEO draft must be a JSON object.';
  end if;

  if coalesce(page_family, '') not in ('product-hub', 'category-hub', 'listing', 'lifestyle', 'detail', 'prompt', 'tutorial', 'feature') then
    raise exception 'SEO draft pageFamily is invalid.';
  end if;
  if page_status not in ('draft', 'automated_qa', 'editor_review', 'changes_requested', 'refresh') then
    raise exception 'SEO draft status must be a non-approved review state.';
  end if;
  if raw_path is null or raw_path = '' or raw_path ~ '[?&#%]|//' then
    raise exception 'SEO draft path must be a clean crawlable path.';
  end if;
  normalized_path := case when raw_path = '/' then '/' else '/' || trim(both '/' from raw_path) || '/' end;
  if normalized_path !~ '^/[a-z0-9][a-z0-9/_-]*\/?$' then
    raise exception 'SEO draft path contains unsupported characters.';
  end if;
  page_slug := regexp_replace(trim(both '/' from normalized_path), '^.*/', '');
  if page_slug = '' then
    raise exception 'SEO draft path must contain a page slug.';
  end if;

  product_slug := lower(regexp_replace(regexp_replace(coalesce(payload->>'productEntity', ''), '[^a-zA-Z0-9]+', '-', 'g'), '(^-|-$)', '', 'g'));
  if product_slug = '' then
    raise exception 'SEO draft productEntity is required.';
  end if;
  topic_slug := product_slug;
  normalized_intent_key := lower(regexp_replace(regexp_replace(coalesce(intent_key, ''), '[^a-zA-Z0-9]+', '-', 'g'), '(^-|-$)', '', 'g'));
  if normalized_intent_key = '' then
    raise exception 'SEO draft intentKey is required.';
  end if;
  job_slug := lower(regexp_replace(regexp_replace(coalesce(payload->'content'->>'jobSlug', page_slug), '[^a-zA-Z0-9]+', '-', 'g'), '(^-|-$)', '', 'g'));
  if job_slug = '' then job_slug := page_slug; end if;

  begin
    author_id := nullif(payload->'author'->>'id', '')::uuid;
    reviewer_id := nullif(payload->'reviewer'->>'id', '')::uuid;
  exception when invalid_text_representation then
    raise exception 'SEO draft author and reviewer IDs must be UUIDs.';
  end;
  if author_id is null or reviewer_id is null then
    raise exception 'SEO draft requires author and reviewer IDs.';
  end if;
  if not exists (select 1 from public.content_members where user_id = author_id and is_active = true)
    or not exists (select 1 from public.content_members where user_id = reviewer_id and is_active = true) then
    raise exception 'SEO draft author and reviewer must be active content members.';
  end if;

  if jsonb_typeof(payload->'generationRuns') <> 'array' or coalesce(jsonb_array_length(payload->'generationRuns'), 0) < 3 then
    raise exception 'SEO draft requires at least three generation runs.';
  end if;
  if jsonb_typeof(payload->'media') <> 'array' or coalesce(jsonb_array_length(payload->'media'), 0) < 1 then
    raise exception 'SEO draft requires media records.';
  end if;
  if jsonb_typeof(payload->'sources') <> 'array' or coalesce(jsonb_array_length(payload->'sources'), 0) < 1 then
    raise exception 'SEO draft requires source records.';
  end if;
  if jsonb_typeof(payload->'links') <> 'object'
    or jsonb_typeof(payload->'links'->'inbound') <> 'array'
    or coalesce(jsonb_array_length(payload->'links'->'inbound'), 0) < 2
    or jsonb_typeof(payload->'links'->'outbound') <> 'array'
    or coalesce(jsonb_array_length(payload->'links'->'outbound'), 0) < 4 then
    raise exception 'SEO draft requires at least two inbound and four outbound links.';
  end if;

  select id into existing_page_id from public.seo_pages where path = normalized_path;
  if existing_page_id is not null then
    raise exception 'SEO draft path already exists; use the review/update workflow instead of replacing it.';
  end if;

  topic_kind := case
    when page_family in ('feature', 'tutorial') then page_family
    when page_family = 'category-hub' then 'category'
    else 'product'
  end;
  insert into public.seo_topics (locale, kind, name, slug, buyer_questions, demand_evidence, rights_status, status, created_by)
  values (
    v_locale,
    topic_kind,
    left(coalesce(payload->>'productEntity', topic_slug), 160),
    topic_slug,
    jsonb_build_array(coalesce(payload->>'buyerQuestion', '')),
    coalesce(payload->'evidencePacket', '[]'::jsonb),
    'approved',
    'approved',
    author_id
  )
  on conflict (locale, kind, slug) do update set
    buyer_questions = excluded.buyer_questions,
    demand_evidence = excluded.demand_evidence,
    rights_status = 'approved',
    status = 'approved',
    updated_at = now()
  returning id into topic_id;

  page_id := case
    when (payload->>'pageId') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
      then (payload->>'pageId')::uuid
    else gen_random_uuid()
  end;
  quality_score := case when (payload->>'qualityScore') ~ '^[0-9]+$' then (payload->>'qualityScore')::integer else null end;
  if quality_score is null or quality_score < 85 or quality_score > 100 then
    raise exception 'SEO draft qualityScore must be between 85 and 100.';
  end if;
  if jsonb_typeof(payload->'qualityChecks') <> 'object' or coalesce(payload->'qualityChecks'->>'status', '') <> 'pass' then
    raise exception 'SEO draft must include a passing deterministic validation result.';
  end if;
  content_body := coalesce(payload->'content', '{}'::jsonb) || jsonb_build_object('buyerQuestion', payload->>'buyerQuestion');
  insert into public.seo_pages (
    id, topic_id, locale, page_family, status, path, slug, product_slug, job_slug,
    title, meta_title, meta_description, direct_answer, primary_query, primary_intent,
    normalized_intent_key, body, author_id, reviewer_id, template_version, cohort_id,
    quality_score, noindex
  ) values (
    page_id,
    topic_id,
    v_locale,
    page_family,
    page_status,
    normalized_path,
    page_slug,
    product_slug,
    job_slug,
    left(coalesce(payload->>'title', page_slug), 180),
    left(coalesce(payload->>'metaTitle', payload->>'title', page_slug), 180),
    left(coalesce(payload->>'metaDescription', ''), 320),
    left(coalesce(payload->>'directAnswer', ''), 1000),
    left(coalesce(payload->>'primaryQuery', payload->>'buyerQuestion', intent_key), 240),
    left(coalesce(payload->>'primaryIntent', intent_key), 500),
    normalized_intent_key,
    content_body,
    author_id,
    reviewer_id,
    left(coalesce(payload->>'templateVersion', 'seo-v1'), 40),
    nullif(left(payload->>'cohortId', 80), ''),
    quality_score,
    true
  );
  insert into public.seo_quality_runs (page_id, gate_version, status, score, checks, blockers)
  values (
    page_id,
    'draft-validator-v1',
    'pass',
    coalesce(quality_score, 0),
    case when jsonb_typeof(payload->'qualityChecks') = 'object' then payload->'qualityChecks' else jsonb_build_object('source', 'seo:ingest') end,
    '{}'
  );

  for run in select value from jsonb_array_elements(payload->'generationRuns') loop
    image_job := run->>'imageJob';
    if coalesce(image_job, '') not in ('listing', 'lifestyle', 'detail', 'prompt', 'tutorial') then
      raise exception 'SEO generation run imageJob is invalid.';
    end if;
    if run->>'creatorRoute' is null or run->>'creatorRoute' not like '/create/%'
      or run->>'prompt' is null or length(run->>'prompt') < 10
      or run->>'kitChecksum' is null or (run->>'kitChecksum') !~ '^[a-fA-F0-9]{64}$' then
      raise exception 'SEO generation run is missing creator route, prompt, or checksum.';
    end if;
    if coalesce(run->>'qaStatus', 'pending') not in ('pending', 'pass', 'fail', 'superseded') then
      raise exception 'SEO generation run qaStatus is invalid.';
    end if;
    if coalesce(run->>'qaStatus', 'pending') <> 'pass' then run_qa_failed := true; end if;
    run_id := gen_random_uuid();
    external_id := nullif(run->>'runId', '');
    if external_id is not null then run_map := jsonb_set(run_map, array[external_id], to_jsonb(run_id), true); end if;
    image_jobs := array_append(image_jobs, image_job);
    insert into public.seo_generation_runs (
      id, topic_id, opportunity_id, image_job, creator_asset_id, creator_route,
      arena_id, source_asset, settings, prompt, negative_constraints, kit_path,
      kit_checksum, qa_status, qa_summary, recorded_at, created_by
    ) values (
      run_id,
      topic_id,
      nullif(run->>'opportunityId', ''),
      image_job,
      case when (run->>'creatorAssetId') ~ '^[0-9a-fA-F-]{36}$' then (run->>'creatorAssetId')::uuid else null end,
      run->>'creatorRoute',
      left(coalesce(run->>'arenaId', 'product'), 120),
      coalesce(run->'sourceAsset', '{}'::jsonb),
      case when jsonb_typeof(run->'settings') = 'object' then run->'settings' else '{}'::jsonb end,
      run->>'prompt',
      case when jsonb_typeof(run->'negativeConstraints') = 'array' then array(select jsonb_array_elements_text(run->'negativeConstraints')) else '{}' end,
      nullif(run->>'kitPath', ''),
      lower(run->>'kitChecksum'),
      coalesce(run->>'qaStatus', 'pending'),
      case when jsonb_typeof(run->'qaSummary') = 'object' then run->'qaSummary' else '{}'::jsonb end,
      case when nullif(run->>'recordedAt', '') is null then null else (run->>'recordedAt')::timestamptz end,
      author_id
    );
    insert into public.seo_page_generation_runs (page_id, generation_run_id, evidence_role)
    values (page_id, run_id, case when image_job in ('listing', 'lifestyle', 'detail') then 'primary' else 'supporting' end);
  end loop;
  if not ('listing' = any(image_jobs) and 'lifestyle' = any(image_jobs) and 'detail' = any(image_jobs)) then
    raise exception 'SEO draft must include independent listing, lifestyle, and detail generation evidence.';
  end if;
  if run_qa_failed then
    raise exception 'SEO draft generation evidence must have passed QA.';
  end if;

  for media_item in select value from jsonb_array_elements(payload->'media') loop
    external_id := nullif(media_item->>'assetId', '');
    asset_role := coalesce(media_item->>'role', 'selected');
    if asset_role not in ('source', 'hero', 'selected', 'rejected', 'corrected', 'screenshot', 'video', 'og') then
      raise exception 'SEO media role is invalid.';
    end if;
    media_url := media_item->>'url';
    media_checksum := regexp_replace(lower(coalesce(media_item->>'checksum', '')), '^sha256:', '');
    if media_url is null or media_url !~ '^https://'
      or media_checksum !~ '^[a-f0-9]{64}$'
      or coalesce((media_item->>'width')::integer, 0) < 320
      or coalesce((media_item->>'height')::integer, 0) < 320
      or coalesce(media_item->>'alt', '') = '' then
      raise exception 'SEO media record is missing a durable URL, checksum, dimensions, or alt text.';
    end if;
    asset_id := gen_random_uuid();
    if external_id is not null then asset_map := jsonb_set(asset_map, array[external_id], to_jsonb(asset_id), true); end if;
    if asset_role = 'source' then has_source_asset := true; end if;
    if asset_role in ('hero', 'selected') then has_selected_asset := true; end if;
    rights_status := case when media_item->>'rightsStatus' in ('rejected', 'restricted') then media_item->>'rightsStatus' else 'approved' end;
    logo_policy := coalesce(nullif(media_item->>'logoPolicy', ''), payload->'content'->'platform'->>'logoPolicy', 'unverified_brand');
    insert into public.seo_assets (
      id, page_id, generation_run_id, role, public_url, storage_key, checksum,
      mime_type, width, height, alt_text, caption, provenance, rights_status,
      qa_status, ai_provenance, generation_metadata, logo_policy
    ) values (
      asset_id,
      page_id,
      case when (media_item->>'generationRunId') is not null and run_map ? (media_item->>'generationRunId') then (run_map->>(media_item->>'generationRunId'))::uuid else null end,
      asset_role,
      media_url,
      coalesce(nullif(media_item->>'storageKey', ''), format('seo/%s/%s', page_id, asset_id)),
      media_checksum,
      coalesce(media_item->>'mimeType', 'image/webp'),
      (media_item->>'width')::integer,
      (media_item->>'height')::integer,
      left(media_item->>'alt', 500),
      left(media_item->>'caption', 1000),
      left(coalesce(media_item->>'provenance', payload->'content'->'sourceAsset'->>'provenance', 'user-supplied'), 1000),
      rights_status,
      case when coalesce(media_item->>'qaStatus', 'pending') in ('pass', 'fail') then media_item->>'qaStatus' else 'pending' end,
      nullif(media_item->>'aiProvenance', ''),
      coalesce(media_item->'generationMetadata', '{}'::jsonb) || jsonb_build_object('externalAssetId', external_id),
      logo_policy
    );
  end loop;
  if not has_source_asset or not has_selected_asset then
    raise exception 'SEO draft requires source and selected media assets.';
  end if;

  for source_item in select value from jsonb_array_elements(payload->'sources') loop
    if coalesce(source_item->>'url', '') !~ '^https://'
      or coalesce(source_item->>'title', '') = ''
      or coalesce(source_item->>'accessedAt', '') = '' then
      raise exception 'SEO source record is missing HTTPS URL, title, or accessedAt.';
    end if;
    insert into public.seo_sources (page_id, title, url, publisher, claim_ids, accessed_at, review_after)
    values (
      page_id,
      left(source_item->>'title', 300),
      source_item->>'url',
      nullif(left(source_item->>'publisher', 300), ''),
      case when jsonb_typeof(source_item->'claimsSupported') = 'array' then array(select jsonb_array_elements_text(source_item->'claimsSupported')) else '{}' end,
      (source_item->>'accessedAt')::timestamptz,
      case when nullif(source_item->>'reviewAfter', '') is null then null else (source_item->>'reviewAfter')::timestamptz end
    )
    on conflict on constraint seo_sources_page_id_url_key do update set
      title = excluded.title,
      publisher = excluded.publisher,
      claim_ids = excluded.claim_ids,
      accessed_at = excluded.accessed_at,
      review_after = excluded.review_after;
  end loop;

  for link_item in select value from jsonb_array_elements(payload->'links'->'inbound') loop
    link_path := case when link_item->>'path' = '/' then '/' else '/' || trim(both '/' from link_item->>'path') || '/' end;
    if link_path !~ '^/[a-z0-9][a-z0-9/_-]*\/?$' or coalesce(link_item->>'anchor', '') = '' then
      raise exception 'SEO inbound link is invalid.';
    end if;
    insert into public.seo_link_edges (source_page_id, source_url, target_page_id, target_url, anchor_text, placement, nofollow)
    values (null, 'https://airveek.com' || link_path, page_id, 'https://airveek.com' || normalized_path, left(link_item->>'anchor', 240), 'navigation', false)
    on conflict (source_url, target_url, anchor_text, placement) do update set last_seen_at = now();
    select id into target_page_id from public.seo_pages where path = link_path and status not in ('merged', 'archived');
    if target_page_id is not null then
      insert into public.seo_links (source_page_id, target_page_id, link_type, anchor_text)
      values (target_page_id, page_id, 'related', left(link_item->>'anchor', 240))
      on conflict on constraint seo_links_source_page_id_target_page_id_link_type_key do update set anchor_text = excluded.anchor_text, updated_at = now();
    end if;
  end loop;

  for link_item in select value from jsonb_array_elements(payload->'links'->'outbound') loop
    link_path := case when link_item->>'path' = '/' then '/' else '/' || trim(both '/' from link_item->>'path') || '/' end;
    if link_path !~ '^/[a-z0-9][a-z0-9/_-]*\/?$' or coalesce(link_item->>'anchor', '') = '' then
      raise exception 'SEO outbound link is invalid.';
    end if;
    link_type := case
      when link_path like '/tutorials/%' then 'tutorial'
      when link_path like '/features/%' then 'feature'
      when link_path like '/product-photo-prompts/%' then 'prompt'
      when link_path like '/product-photography/%' then 'related'
      else 'related'
    end;
    insert into public.seo_link_edges (source_page_id, source_url, target_page_id, target_url, anchor_text, placement, nofollow)
    values (page_id, 'https://airveek.com' || normalized_path, null, 'https://airveek.com' || link_path, left(link_item->>'anchor', 240), 'body', false)
    on conflict (source_url, target_url, anchor_text, placement) do update set source_page_id = page_id, last_seen_at = now();
    select id into target_page_id from public.seo_pages where path = link_path and status not in ('merged', 'archived');
    if target_page_id is not null then
      insert into public.seo_links (source_page_id, target_page_id, link_type, anchor_text)
      values (page_id, target_page_id, link_type, left(link_item->>'anchor', 240))
      on conflict on constraint seo_links_source_page_id_target_page_id_link_type_key do update set anchor_text = excluded.anchor_text, updated_at = now();
    end if;
  end loop;

  return page_id;
exception when unique_violation then
  raise exception 'SEO draft conflicts with an existing path, intent, checksum, or link record.';
end;
$$;

revoke all on function public.ingest_seo_page_draft(jsonb) from public, anon, authenticated;
grant execute on function public.ingest_seo_page_draft(jsonb) to service_role;

comment on function public.ingest_seo_page_draft(jsonb) is
  'Atomically imports a validated, non-live SEO draft and its evidence graph; service-role only.';

commit;
