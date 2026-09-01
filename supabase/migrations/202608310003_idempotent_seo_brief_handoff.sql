begin;

-- Make research-to-brief retries safe. A worker may lose its response after
-- the transaction commits, so retrying the same brief key must return the
-- existing handoff instead of raising a unique-key error or creating another
-- evidence packet. Identity fields are checked to prevent accidental reuse
-- of a key for a different search intent.
create or replace function public.create_seo_brief_handoff(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
volatile
as $$
declare
  payload jsonb := coalesce(p_payload, '{}'::jsonb);
  topic_payload jsonb;
  demand_evidence jsonb;
  topic_id uuid;
  brief_id uuid;
  brief_key_value text;
  topic_locale text;
  topic_kind_value text;
  topic_name_value text;
  topic_slug_value text;
  page_family_value text;
  product_entity_value text;
  primary_query_value text;
  normalized_intent_key_value text;
  buyer_question_value text;
  opportunity_score_value smallint;
  priority_value smallint;
  template_version_value text;
  existing_topic_id uuid;
  existing_status text;
  existing_locale text;
  existing_page_family text;
  existing_product_entity text;
  existing_primary_query text;
  existing_intent_key text;
  existing_buyer_question text;
  existing_template_version text;
begin
  if jsonb_typeof(payload) <> 'object' then
    raise exception 'SEO brief payload must be a JSON object.';
  end if;

  topic_payload := case when jsonb_typeof(payload->'topic') = 'object' then payload->'topic' else '{}'::jsonb end;
  brief_key_value := nullif(btrim(payload->>'briefKey'), '');
  topic_locale := coalesce(nullif(btrim(topic_payload->>'locale'), ''), 'en');
  topic_kind_value := nullif(btrim(topic_payload->>'kind'), '');
  topic_name_value := nullif(btrim(topic_payload->>'name'), '');
  topic_slug_value := nullif(btrim(topic_payload->>'slug'), '');
  page_family_value := nullif(btrim(payload->>'pageFamily'), '');
  product_entity_value := nullif(btrim(payload->>'productEntity'), '');
  primary_query_value := nullif(btrim(payload->>'primaryQuery'), '');
  normalized_intent_key_value := nullif(btrim(payload->>'normalizedIntentKey'), '');
  buyer_question_value := nullif(btrim(payload->>'buyerQuestion'), '');
  demand_evidence := case when jsonb_typeof(payload->'demandEvidence') = 'array' then payload->'demandEvidence' else '[]'::jsonb end;
  opportunity_score_value := case when payload->>'opportunityScore' is null or payload->>'opportunityScore' = '' then null else (payload->>'opportunityScore')::smallint end;
  priority_value := coalesce(nullif(payload->>'priority', '')::smallint, 50);
  template_version_value := coalesce(nullif(btrim(payload->>'templateVersion'), ''), 'seo-v1');

  if brief_key_value is null or brief_key_value !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'SEO brief key is missing or invalid.';
  end if;
  if topic_kind_value not in ('product', 'category', 'feature', 'tutorial') then
    raise exception 'SEO topic kind is invalid.';
  end if;
  if topic_name_value is null or topic_slug_value is null or topic_slug_value !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'SEO topic identity is missing or invalid.';
  end if;
  if page_family_value not in ('product-hub', 'category-hub', 'listing', 'lifestyle', 'detail', 'prompt', 'tutorial', 'feature') then
    raise exception 'SEO page family is invalid.';
  end if;
  if product_entity_value is null or primary_query_value is null or normalized_intent_key_value is null or buyer_question_value is null then
    raise exception 'SEO brief identity and buyer question are required.';
  end if;
  if jsonb_array_length(demand_evidence) < 3 then
    raise exception 'SEO brief demand evidence requires at least three items.';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(demand_evidence) as evidence_item
    where jsonb_typeof(evidence_item) <> 'object'
      or nullif(btrim(evidence_item->>'url'), '') is null
      or lower(left(btrim(evidence_item->>'url'), 8)) <> 'https://'
      or nullif(btrim(evidence_item->>'title'), '') is null
      or nullif(btrim(evidence_item->>'accessedAt'), '') is null
      or btrim(evidence_item->>'accessedAt') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      or nullif(btrim(evidence_item->>'claimSupported'), '') is null
      or length(btrim(evidence_item->>'claimSupported')) < 10
  ) then
    raise exception 'SEO brief demand evidence requires distinct, labelled HTTPS sources with provenance.';
  end if;
  if (
    select count(distinct lower(regexp_replace(btrim(evidence_item->>'url'), '/+$', '')))
    from jsonb_array_elements(demand_evidence) as evidence_item
  ) <> jsonb_array_length(demand_evidence) then
    raise exception 'SEO brief demand evidence sources must be distinct.';
  end if;
  if opportunity_score_value is not null and (opportunity_score_value < 0 or opportunity_score_value > 100) then
    raise exception 'SEO opportunity score must be between 0 and 100.';
  end if;
  if priority_value < 0 or priority_value > 100 then
    raise exception 'SEO brief priority must be between 0 and 100.';
  end if;

  -- Fast path for a retry. Lock the row so two workers cannot both decide that
  -- the key is new and then create competing handoffs.
  select b.id, b.topic_id, b.status, b.locale, b.page_family, b.product_entity,
         b.primary_query, b.normalized_intent_key, b.buyer_question, b.template_version
    into brief_id, existing_topic_id, existing_status, existing_locale,
         existing_page_family, existing_product_entity, existing_primary_query,
         existing_intent_key, existing_buyer_question, existing_template_version
    from public.seo_content_briefs b
   where b.brief_key = brief_key_value
   for update;
  if found then
    if existing_locale <> topic_locale
       or existing_page_family <> page_family_value
       or existing_product_entity <> product_entity_value
       or existing_primary_query <> primary_query_value
       or existing_intent_key <> normalized_intent_key_value
       or existing_buyer_question <> buyer_question_value
       or existing_template_version <> template_version_value then
      raise exception 'SEO brief key already exists with a different identity: %.', brief_key_value;
    end if;
    return jsonb_build_object(
      'topicId', existing_topic_id,
      'briefId', brief_id,
      'briefKey', brief_key_value,
      'status', existing_status,
      'idempotent', true
    );
  end if;

  insert into public.seo_topics (
    locale, kind, name, slug, buyer_questions, demand_evidence,
    opportunity_score, rights_status, status
  ) values (
    topic_locale, topic_kind_value, left(topic_name_value, 160), topic_slug_value,
    jsonb_build_array(buyer_question_value), demand_evidence,
    opportunity_score_value, 'unreviewed', 'candidate'
  )
  on conflict (locale, kind, slug) do nothing
  returning id into topic_id;

  if topic_id is null then
    select id into topic_id
    from public.seo_topics
    where seo_topics.locale = topic_locale
      and seo_topics.kind = topic_kind_value
      and seo_topics.slug = topic_slug_value;
  end if;
  if topic_id is null then
    raise exception 'SEO topic could not be resolved after the insert.';
  end if;

  insert into public.seo_content_briefs (
    brief_key, topic_id, locale, page_family, product_entity,
    primary_query, normalized_intent_key, buyer_question, brief,
    demand_evidence, opportunity_score, priority, template_version,
    status
  ) values (
    brief_key_value, topic_id, topic_locale, page_family_value, product_entity_value,
    primary_query_value, normalized_intent_key_value, buyer_question_value, payload,
    demand_evidence, opportunity_score_value, priority_value, template_version_value,
    'ready_for_assignment'
  )
  on conflict (brief_key) do nothing
  returning id into brief_id;

  if brief_id is null then
    -- A concurrent transaction won the unique-key race after the initial
    -- lookup. Resolve it through the same identity guard and return it.
    select b.id, b.topic_id, b.status, b.locale, b.page_family, b.product_entity,
           b.primary_query, b.normalized_intent_key, b.buyer_question, b.template_version
      into brief_id, existing_topic_id, existing_status, existing_locale,
           existing_page_family, existing_product_entity, existing_primary_query,
           existing_intent_key, existing_buyer_question, existing_template_version
      from public.seo_content_briefs b
     where b.brief_key = brief_key_value
     for update;
    if not found then
      raise exception 'SEO brief could not be resolved after the insert.';
    end if;
    if existing_locale <> topic_locale
       or existing_page_family <> page_family_value
       or existing_product_entity <> product_entity_value
       or existing_primary_query <> primary_query_value
       or existing_intent_key <> normalized_intent_key_value
       or existing_buyer_question <> buyer_question_value
       or existing_template_version <> template_version_value then
      raise exception 'SEO brief key already exists with a different identity: %.', brief_key_value;
    end if;
    return jsonb_build_object(
      'topicId', existing_topic_id,
      'briefId', brief_id,
      'briefKey', brief_key_value,
      'status', existing_status,
      'idempotent', true
    );
  end if;

  insert into public.seo_evidence_packets (
    brief_id, packet_type, status, rights_status, packet
  ) values
    (brief_id, 'research', 'draft', 'unreviewed', jsonb_build_object('source', 'seo:create-brief', 'createdAt', now()::text)),
    (brief_id, 'rights', 'draft', 'unreviewed', jsonb_build_object('source', 'seo:create-brief', 'createdAt', now()::text));

  return jsonb_build_object(
    'topicId', topic_id,
    'briefId', brief_id,
    'briefKey', brief_key_value,
    'status', 'ready_for_assignment',
    'idempotent', false
  );
end;
$$;

revoke all on function public.create_seo_brief_handoff(jsonb) from public, anon, authenticated;
grant execute on function public.create_seo_brief_handoff(jsonb) to service_role;

comment on function public.create_seo_brief_handoff(jsonb) is
  'Atomically and idempotently creates a research-to-writer SEO brief, topic handoff, and draft research/rights packets. Service-role only; retries return the existing identity-matched handoff and never create or publish a page.';

commit;
