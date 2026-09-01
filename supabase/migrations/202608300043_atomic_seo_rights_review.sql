begin;

-- Rights approval is a single trust-boundary operation. Keep the exact source
-- checksum, reviewer attribution, packet state, topic mirror, decision ledger,
-- and audit event in one transaction so a partial write can never look like a
-- complete approval.
create extension if not exists pgcrypto with schema extensions;

create or replace function public.review_seo_rights(
  p_brief_id uuid,
  p_reviewer_id uuid,
  p_rights_evidence_id text,
  p_source_checksum text,
  p_item_key text,
  p_request_id text,
  p_source_url text default null,
  p_source_label text default null,
  p_review_after timestamptz default null,
  p_notes text default null,
  p_reviewed_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
volatile
as $$
declare
  brief_topic_id uuid;
  brief_status text;
  packet_id uuid;
  packet_status text;
  packet_rights_status text;
  packet_payload jsonb;
  packet_review jsonb;
  next_packet jsonb;
  packet_checksum text;
  item_id uuid;
  item_rights_status text;
  item_evidence_id text;
  item_metadata jsonb;
  topic_rights_status text;
  topic_demand_evidence jsonb;
  next_demand_evidence jsonb;
  topic_rights_entry jsonb;
  topic_rights_match boolean := false;
  existing_review jsonb;
  review_decision_id uuid;
  audit_id uuid;
  normalized_checksum text := regexp_replace(lower(btrim(coalesce(p_source_checksum, ''))), '^sha256:', '');
  safe_source_url text := nullif(btrim(p_source_url), '');
  safe_source_label text := nullif(btrim(p_source_label), '');
  safe_notes text := nullif(btrim(p_notes), '');
  safe_reviewed_at timestamptz := coalesce(p_reviewed_at, now());
  demand_entry jsonb;
  demand_checksum text;
begin
  if p_brief_id is null or p_reviewer_id is null then
    raise exception 'SEO brief and reviewer are required.';
  end if;
  if p_rights_evidence_id is null
     or char_length(p_rights_evidence_id) < 3
     or char_length(p_rights_evidence_id) > 200
     or p_rights_evidence_id ~ '[\u0000-\u001f\u007f]' then
    raise exception 'SEO rights evidence ID is invalid.';
  end if;
  if normalized_checksum !~ '^[a-f0-9]{64}$' then
    raise exception 'SEO source checksum must be a SHA-256 hex digest.';
  end if;
  if p_item_key is null or p_item_key !~ '^rights:[a-f0-9]{32}$' then
    raise exception 'SEO rights item key is invalid.';
  end if;
  if p_request_id is null or char_length(p_request_id) < 8 or char_length(p_request_id) > 180 then
    raise exception 'SEO rights request ID is invalid.';
  end if;
  if safe_source_url is not null and safe_source_url !~ '^https://' then
    raise exception 'SEO source URL must use HTTPS.';
  end if;
  if safe_source_label is not null and char_length(safe_source_label) > 500 then
    raise exception 'SEO source label is too long.';
  end if;
  if safe_notes is not null and char_length(safe_notes) > 8000 then
    raise exception 'SEO rights notes are too long.';
  end if;

  select b.topic_id, b.status
    into brief_topic_id, brief_status
    from public.seo_content_briefs b
   where b.id = p_brief_id
   for update;
  if not found then
    raise exception 'SEO brief not found.';
  end if;
  if brief_status in ('archived', 'merged') then
    raise exception 'SEO brief is not open for rights review.';
  end if;

  if not exists (
    select 1
      from public.content_members cm
     where cm.user_id = p_reviewer_id
       and cm.is_active = true
       and cm.role in ('editor', 'publisher', 'seo_admin')
  ) then
    raise exception 'SEO rights review requires an active editor, publisher, or SEO-admin reviewer.';
  end if;

  select ep.id, ep.status, ep.rights_status, ep.packet
    into packet_id, packet_status, packet_rights_status, packet_payload
    from public.seo_evidence_packets ep
   where ep.brief_id = p_brief_id
     and ep.packet_type = 'rights'
   order by ep.version desc
   limit 1
   for update;
  if not found then
    raise exception 'SEO rights packet not found; create the brief first.';
  end if;
  if packet_status not in ('draft', 'submitted', 'approved') then
    raise exception 'SEO rights packet is not open for review.';
  end if;
  packet_payload := case when jsonb_typeof(packet_payload) = 'object' then packet_payload else '{}'::jsonb end;
  packet_review := case when jsonb_typeof(packet_payload->'rightsReview') = 'object' then packet_payload->'rightsReview' else null end;

  select ei.id, ei.rights_status, ei.rights_evidence_id, ei.metadata
    into item_id, item_rights_status, item_evidence_id, item_metadata
    from public.seo_evidence_items ei
   where ei.packet_id = packet_id
     and ei.item_key = p_item_key
   for update;
  if found then
    item_metadata := case when jsonb_typeof(item_metadata) = 'object' then item_metadata else '{}'::jsonb end;
    if item_rights_status <> 'approved'
       or item_evidence_id <> p_rights_evidence_id
       or regexp_replace(lower(coalesce(item_metadata->>'sourceAssetChecksum', '')), '^sha256:', '') <> normalized_checksum then
      raise exception 'SEO rights item conflicts with the requested source or checksum.';
    end if;
  else
    insert into public.seo_evidence_items (
      packet_id, item_key, item_type, source_url, source_title,
      claim_key, claim_text, rights_status, rights_evidence_id,
      accessed_at, review_after, metadata, collected_by
    ) values (
      packet_id, p_item_key, 'rights', safe_source_url, safe_source_label,
      'source_asset_rights',
      'Source asset ' || p_rights_evidence_id || ' was reviewed and approved for Airveek use by an authorized content reviewer.',
      'approved', p_rights_evidence_id,
      case when safe_source_url is not null then safe_reviewed_at else null end,
      p_review_after,
      jsonb_strip_nulls(jsonb_build_object(
        'sourceAssetChecksum', 'sha256:' || normalized_checksum,
        'decision', 'approved',
        'reviewerId', p_reviewer_id,
        'reviewedAt', safe_reviewed_at,
        'sourceAssetLabel', safe_source_label,
        'sourceAssetUrl', safe_source_url,
        'notes', safe_notes
      )),
      p_reviewer_id
    ) returning id into item_id;
  end if;

  if packet_status = 'approved' and packet_rights_status = 'approved' then
    if packet_review is null
       or packet_review->>'decision' <> 'approved'
       or packet_review->>'rightsEvidenceId' <> p_rights_evidence_id
       or regexp_replace(lower(coalesce(packet_review->>'sourceAssetChecksum', '')), '^sha256:', '') <> normalized_checksum then
      raise exception 'Approved SEO rights packet conflicts with the requested review.';
    end if;
  else
    packet_review := jsonb_strip_nulls(jsonb_build_object(
      'decision', 'approved',
      'rightsEvidenceId', p_rights_evidence_id,
      'sourceAssetChecksum', 'sha256:' || normalized_checksum,
      'sourceAssetUrl', safe_source_url,
      'sourceAssetLabel', safe_source_label,
      'reviewedBy', p_reviewer_id,
      'reviewedAt', safe_reviewed_at,
      'reviewAfter', p_review_after,
      'notes', safe_notes
    ));
    next_packet := packet_payload || jsonb_build_object('rightsReview', packet_review);
    packet_checksum := encode(extensions.digest(convert_to(next_packet::text, 'UTF8'), 'sha256'), 'hex');
    update public.seo_evidence_packets
       set status = 'approved',
           rights_status = 'approved',
           packet_checksum = packet_checksum,
           packet = next_packet,
           summary = 'Rights approved for source asset ' || p_rights_evidence_id || ' by reviewer ' || p_reviewer_id::text,
           reviewed_by = p_reviewer_id,
           reviewed_at = safe_reviewed_at,
           updated_at = safe_reviewed_at
     where id = packet_id;
  end if;

  select t.rights_status, t.demand_evidence
    into topic_rights_status, topic_demand_evidence
    from public.seo_topics t
   where t.id = brief_topic_id
   for update;
  if not found then
    raise exception 'SEO brief topic not found.';
  end if;
  topic_demand_evidence := case when jsonb_typeof(topic_demand_evidence) = 'array' then topic_demand_evidence else '[]'::jsonb end;
  for demand_entry in select value from jsonb_array_elements(topic_demand_evidence) loop
    if jsonb_typeof(demand_entry) = 'object'
       and demand_entry->>'type' = 'rights'
       and demand_entry->>'evidenceId' = p_rights_evidence_id then
      demand_checksum := regexp_replace(lower(coalesce(demand_entry->>'sourceAssetChecksum', demand_entry->>'checksum', '')), '^sha256:', '');
      if demand_checksum <> '' and demand_checksum <> normalized_checksum then
        raise exception 'SEO topic rights evidence conflicts with the requested source checksum.';
      end if;
      if demand_checksum = normalized_checksum
         and demand_entry->>'reviewer' = p_reviewer_id::text
         and demand_entry->>'status' = 'approved' then
        topic_rights_match := true;
      end if;
    end if;
  end loop;
  topic_rights_entry := jsonb_strip_nulls(jsonb_build_object(
    'type', 'rights',
    'status', 'approved',
    'evidenceId', p_rights_evidence_id,
    'reviewer', p_reviewer_id,
    'reviewedAt', safe_reviewed_at,
    'sourceAssetChecksum', 'sha256:' || normalized_checksum,
    'sourceUrl', safe_source_url,
    'sourceLabel', safe_source_label
  ));
  next_demand_evidence := case when topic_rights_match then topic_demand_evidence else topic_demand_evidence || jsonb_build_array(topic_rights_entry) end;
  if topic_rights_status <> 'approved' or not topic_rights_match then
    update public.seo_topics
       set rights_status = 'approved',
           demand_evidence = next_demand_evidence,
           updated_at = safe_reviewed_at
     where id = brief_topic_id;
  end if;

  select rd.id
    into review_decision_id
    from public.seo_review_decisions rd
   where rd.brief_id = p_brief_id
     and rd.packet_id = packet_id
     and rd.review_type = 'rights'
     and rd.decision = 'approved'
     and rd.content_version = 'rights-packet-v1'
     and rd.reviewer_id = p_reviewer_id
   order by rd.created_at desc
   limit 1
   for update;
  if not found then
    insert into public.seo_review_decisions (
      brief_id, packet_id, review_type, decision, content_version,
      reviewer_id, score, checklist, blockers, notes
    ) values (
      p_brief_id, packet_id, 'rights', 'approved', 'rights-packet-v1',
      p_reviewer_id, 100,
      jsonb_build_object(
        'packetApproved', true,
        'rightsEvidenceId', p_rights_evidence_id,
        'sourceAssetChecksum', 'sha256:' || normalized_checksum
      ), '{}', coalesce(safe_notes, 'Rights packet approved for source asset ' || p_rights_evidence_id || '.')
    ) returning id into review_decision_id;
  end if;

  select ae.id
    into audit_id
    from public.seo_content_audit_events ae
   where ae.request_id = p_request_id
   order by ae.created_at desc
   limit 1
   for update;
  if not found then
    select public.append_seo_content_audit_event(
      'evidence_packet', packet_id, 'rights.approved', p_reviewer_id,
      packet_status, 'approved', p_request_id,
      jsonb_build_object(
        'briefId', p_brief_id,
        'packetId', packet_id,
        'rightsEvidenceId', p_rights_evidence_id,
        'sourceAssetChecksum', 'sha256:' || normalized_checksum,
        'reviewerId', p_reviewer_id,
        'reviewedAt', safe_reviewed_at
      )
    ) into audit_id;
  end if;

  return jsonb_build_object(
    'briefId', p_brief_id,
    'packetId', packet_id,
    'itemId', item_id,
    'itemKey', p_item_key,
    'auditId', audit_id,
    'reviewDecisionId', review_decision_id,
    'reviewerId', p_reviewer_id,
    'rightsEvidenceId', p_rights_evidence_id,
    'sourceChecksum', 'sha256:' || normalized_checksum,
    'action', case when packet_status = 'approved' and packet_rights_status = 'approved' then 'idempotent_rights_approval' else 'rights_approved' end
  );
end;
$$;

revoke all on function public.review_seo_rights(uuid, uuid, text, text, text, text, text, text, timestamptz, text, timestamptz) from public, anon, authenticated;
grant execute on function public.review_seo_rights(uuid, uuid, text, text, text, text, text, text, timestamptz, text, timestamptz) to service_role;

comment on function public.review_seo_rights(uuid, uuid, text, text, text, text, text, text, timestamptz, text, timestamptz) is
  'Atomically approves one brief source-asset rights packet, exact checksum, topic mirror, reviewer decision, and audit event. Service-role only.';

commit;
