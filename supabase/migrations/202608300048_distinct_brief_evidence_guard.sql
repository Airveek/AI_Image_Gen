begin;

-- Keep the research brief handoff fail-closed even when a caller bypasses the
-- admin UI. Three evidence rows must represent three distinct HTTPS sources;
-- otherwise a malformed or duplicated payload could satisfy the minimum count
-- without adding independent demand evidence.
do $$
declare
  function_definition text;
  original_guard text := $guard$
  if jsonb_array_length(demand_evidence) < 3 then
    raise exception 'SEO brief demand evidence requires at least three items.';
  end if;
$guard$;
  replacement_guard text := $guard$
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
  ) then
    raise exception 'SEO brief demand evidence requires distinct, labelled HTTPS sources.';
  end if;
  if (
    select count(distinct lower(btrim(evidence_item->>'url')))
    from jsonb_array_elements(demand_evidence) as evidence_item
  ) <> jsonb_array_length(demand_evidence) then
    raise exception 'SEO brief demand evidence sources must be distinct.';
  end if;
$guard$;
begin
  select pg_get_functiondef('public.create_seo_brief_handoff(jsonb)'::regprocedure)
    into function_definition;
  if function_definition is null or position(original_guard in function_definition) = 0 then
    raise exception 'Expected create_seo_brief_handoff guard was not found.';
  end if;
  function_definition := replace(function_definition, original_guard, replacement_guard);
  execute function_definition;
end;
$$;

comment on function public.create_seo_brief_handoff(jsonb) is
  'Atomically creates a research-to-writer SEO brief, topic handoff, and draft research/rights packets. Service-role only; requires three distinct labelled HTTPS evidence sources; never creates or publishes a page.';

commit;
