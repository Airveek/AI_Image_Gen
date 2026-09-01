begin;

-- The handoff RPC validates demand evidence at creation time. Keep the same
-- invariant on the brief table so a future worker or privileged admin update
-- cannot replace a valid evidence packet with an incomplete one.
create or replace function public.validate_seo_brief_demand_evidence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if jsonb_typeof(new.demand_evidence) <> 'array'
     or jsonb_array_length(new.demand_evidence) < 3 then
    raise exception 'SEO briefs require at least three demand-evidence sources.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(new.demand_evidence) as evidence_item
    where jsonb_typeof(evidence_item) <> 'object'
      or nullif(btrim(evidence_item->>'url'), '') is null
      or lower(left(btrim(evidence_item->>'url'), 8)) <> 'https://'
      or nullif(btrim(evidence_item->>'title'), '') is null
      or nullif(btrim(evidence_item->>'accessedAt'), '') is null
      or btrim(evidence_item->>'accessedAt') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      or nullif(btrim(evidence_item->>'claimSupported'), '') is null
      or length(btrim(evidence_item->>'claimSupported')) < 10
  ) then
    raise exception 'SEO briefs require labelled HTTPS evidence with an access date and claim text.';
  end if;

  if (
    select count(distinct regexp_replace(lower(btrim(evidence_item->>'url')), '/+$', ''))
    from jsonb_array_elements(new.demand_evidence) as evidence_item
  ) <> jsonb_array_length(new.demand_evidence) then
    raise exception 'SEO brief demand-evidence sources must be distinct.';
  end if;

  return new;
end;
$$;

drop trigger if exists seo_content_briefs_demand_evidence on public.seo_content_briefs;
create trigger seo_content_briefs_demand_evidence
before insert or update of demand_evidence on public.seo_content_briefs
for each row execute function public.validate_seo_brief_demand_evidence();

comment on function public.validate_seo_brief_demand_evidence() is
  'Rejects SEO brief demand evidence that lacks three distinct labelled HTTPS sources, access dates, or claim text; applies on every brief insert and evidence update.';

commit;
