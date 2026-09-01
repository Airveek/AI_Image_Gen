begin;

-- Create the research-to-writer handoff in one database transaction. The
-- command-line generator previously inserted a topic, brief, and evidence
-- packets as three independent requests; a transient failure after either of
-- the first two requests could leave an incomplete queue item behind. This
-- service-role-only RPC keeps the same dry-run/apply boundary while making the
-- apply path all-or-nothing.
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
  brief_key text;
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
begin
  if jsonb_typeof(payload) <> 'object' then
    raise exception 'SEO brief payload must be a JSON object.';
  end if;

  topic_payload := case when jsonb_typeof(payload->'topic') = 'object' then payload->'topic' else '{}'::jsonb end;
  brief_key := nullif(btrim(payload->>'briefKey'), '');
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

  if brief_key is null or brief_key !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
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
  if opportunity_score_value is not null and (opportunity_score_value < 0 or opportunity_score_value > 100) then
    raise exception 'SEO opportunity score must be between 0 and 100.';
  end if;
  if priority_value < 0 or priority_value > 100 then
    raise exception 'SEO brief priority must be between 0 and 100.';
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
    brief_key, topic_id, topic_locale, page_family_value, product_entity_value,
    primary_query_value, normalized_intent_key_value, buyer_question_value, payload,
    demand_evidence, opportunity_score_value, priority_value, template_version_value,
    'ready_for_assignment'
  )
  returning id into brief_id;

  insert into public.seo_evidence_packets (
    brief_id, packet_type, status, rights_status, packet
  ) values
    (brief_id, 'research', 'draft', 'unreviewed', jsonb_build_object('source', 'seo:create-brief', 'createdAt', now()::text)),
    (brief_id, 'rights', 'draft', 'unreviewed', jsonb_build_object('source', 'seo:create-brief', 'createdAt', now()::text));

  return jsonb_build_object(
    'topicId', topic_id,
    'briefId', brief_id,
    'briefKey', brief_key,
    'status', 'ready_for_assignment'
  );
end;
$$;

revoke all on function public.create_seo_brief_handoff(jsonb) from public, anon, authenticated;
grant execute on function public.create_seo_brief_handoff(jsonb) to service_role;

comment on function public.create_seo_brief_handoff(jsonb) is
  'Atomically creates a research-to-writer SEO brief, topic handoff, and draft research/rights packets. Service-role only; never creates or publishes a page.';

commit;
