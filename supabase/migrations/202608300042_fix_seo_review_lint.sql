begin;

-- Keep the applied review handoff function warning-free. The brief status is
-- intentionally selected and checked so the lock/read remains explicit while
-- Supabase's schema linter can verify the variable is used.
create or replace function public.record_seo_review_decision(
  p_brief_id uuid,
  p_page_id uuid default null,
  p_packet_id uuid default null,
  p_review_type text default 'draft',
  p_decision text default 'changes_requested',
  p_content_version text default 'seo-v1',
  p_reviewer_id uuid default null,
  p_score integer default null,
  p_checklist jsonb default '{}'::jsonb,
  p_blockers text[] default '{}',
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
volatile
as $$
declare
  brief_status text;
  linked_page_id uuid;
  decision_id uuid;
  next_brief_status text;
  next_page_status text;
  safe_checklist jsonb := coalesce(p_checklist, '{}'::jsonb);
  safe_blockers text[] := coalesce(p_blockers, '{}'::text[]);
  safe_notes text := nullif(btrim(p_notes), '');
begin
  if p_brief_id is null or p_reviewer_id is null then
    raise exception 'SEO brief and reviewer are required.';
  end if;
  if p_review_type not in ('research', 'rights', 'workflow', 'draft', 'quality', 'editorial', 'publish', 'refresh') then
    raise exception 'SEO review type is invalid.';
  end if;
  if p_decision not in ('approved', 'changes_requested', 'rejected', 'merged', 'deferred') then
    raise exception 'SEO review decision is invalid.';
  end if;
  if p_review_type = 'rights' and p_decision = 'approved' then
    raise exception 'Use the rights-evidence review flow for rights approval.';
  end if;
  if p_content_version is null or char_length(p_content_version) < 1 or char_length(p_content_version) > 120 then
    raise exception 'SEO content version is invalid.';
  end if;
  if p_score is not null and (p_score < 0 or p_score > 100) then
    raise exception 'SEO review score must be between 0 and 100.';
  end if;
  if p_decision = 'approved' and (coalesce(p_score, 0) < 85 or cardinality(safe_blockers) > 0) then
    raise exception 'An approved SEO review requires a score of at least 85 and no blockers.';
  end if;
  if jsonb_typeof(safe_checklist) <> 'object' then
    raise exception 'SEO review checklist must be a JSON object.';
  end if;
  if cardinality(safe_blockers) > 100 then
    raise exception 'SEO review blockers cannot contain more than 100 items.';
  end if;
  if safe_notes is not null and char_length(safe_notes) > 8000 then
    raise exception 'SEO review notes are too long.';
  end if;

  select b.status, b.page_id
    into brief_status, linked_page_id
    from public.seo_content_briefs b
   where b.id = p_brief_id
   for update;
  if not found then
    raise exception 'SEO brief not found.';
  end if;
  if brief_status is null then
    raise exception 'SEO brief status is invalid.';
  end if;
  if p_page_id is not null and linked_page_id is not null and linked_page_id <> p_page_id then
    raise exception 'SEO review page does not match the brief page.';
  end if;

  if p_page_id is not null then
    perform 1 from public.seo_pages p where p.id = p_page_id for update;
    if not found then
      raise exception 'SEO review page not found.';
    end if;
  end if;
  if p_packet_id is not null then
    perform 1 from public.seo_evidence_packets ep where ep.id = p_packet_id and ep.brief_id = p_brief_id for update;
    if not found then
      raise exception 'SEO review evidence packet does not match the brief.';
    end if;
  end if;

  insert into public.seo_review_decisions (
    brief_id, page_id, packet_id, review_type, decision, content_version,
    reviewer_id, score, checklist, blockers, notes
  ) values (
    p_brief_id, p_page_id, p_packet_id, p_review_type, p_decision, p_content_version,
    p_reviewer_id, p_score::smallint, safe_checklist, safe_blockers, safe_notes
  ) returning id into decision_id;

  next_brief_status := case p_decision
    when 'approved' then 'approved'
    when 'changes_requested' then 'changes_requested'
    when 'merged' then 'merged'
    when 'rejected' then 'blocked'
    else 'editor_review'
  end;
  update public.seo_content_briefs
     set status = next_brief_status,
         page_id = coalesce(p_page_id, page_id),
         approved_at = case when p_decision = 'approved' then now() else null end,
         updated_at = now()
   where id = p_brief_id;

  if p_page_id is not null then
    next_page_status := case p_decision
      when 'approved' then 'approved'
      when 'changes_requested' then 'changes_requested'
      when 'merged' then 'merged'
      when 'rejected' then 'qa_failed'
      else 'editor_review'
    end;
    update public.seo_pages
       set status = next_page_status, updated_at = now()
     where id = p_page_id and status <> 'live';
  end if;

  return decision_id;
end;
$$;

revoke all on function public.record_seo_review_decision(uuid, uuid, uuid, text, text, text, uuid, integer, jsonb, text[], text) from public, anon, authenticated;
grant execute on function public.record_seo_review_decision(uuid, uuid, uuid, text, text, text, uuid, integer, jsonb, text[], text) to service_role;

comment on function public.record_seo_review_decision(uuid, uuid, uuid, text, text, text, uuid, integer, jsonb, text[], text) is
  'Atomically records an SEO review decision and advances its brief/draft state. Service-role only; reviewer and evidence validation triggers remain active.';

commit;
