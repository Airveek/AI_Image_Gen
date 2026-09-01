begin;

-- A source URL and label are not enough to make research auditable. Require
-- access date and claim text at the same transaction boundary so every brief
-- can explain what was observed and when it was observed.
do $$
declare
  function_definition text;
  original_guard text := $guard$
      or nullif(btrim(evidence_item->>'title'), '') is null
$guard$;
  replacement_guard text := $guard$
      or nullif(btrim(evidence_item->>'title'), '') is null
      or btrim(evidence_item->>'accessedAt') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
      or length(btrim(evidence_item->>'claimSupported')) < 10
$guard$;
begin
  select pg_get_functiondef('public.create_seo_brief_handoff(jsonb)'::regprocedure)
    into function_definition;
  if function_definition is null or position(original_guard in function_definition) = 0 then
    raise exception 'Expected create_seo_brief_handoff provenance guard was not found.';
  end if;
  function_definition := replace(function_definition, original_guard, replacement_guard);
  execute function_definition;
end;
$$;

comment on function public.create_seo_brief_handoff(jsonb) is
  'Atomically creates a research-to-writer SEO brief, topic handoff, and draft research/rights packets. Service-role only; requires distinct labelled HTTPS evidence sources with access dates and claim text; never creates or publishes a page.';

commit;
