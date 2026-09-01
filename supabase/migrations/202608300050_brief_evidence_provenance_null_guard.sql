begin;

-- PostgreSQL's three-valued logic makes `NULL !~ regex` evaluate to NULL,
-- which does not satisfy an EXISTS predicate. Explicitly reject missing or
-- blank provenance fields as well as malformed values.
do $$
declare
  function_definition text;
  original_guard text := $guard$
      or btrim(evidence_item->>'accessedAt') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
      or length(btrim(evidence_item->>'claimSupported')) < 10
$guard$;
  replacement_guard text := $guard$
      or nullif(btrim(evidence_item->>'accessedAt'), '') is null
      or btrim(evidence_item->>'accessedAt') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      or nullif(btrim(evidence_item->>'claimSupported'), '') is null
      or length(btrim(evidence_item->>'claimSupported')) < 10
$guard$;
begin
  select pg_get_functiondef('public.create_seo_brief_handoff(jsonb)'::regprocedure)
    into function_definition;
  if function_definition is null or position(original_guard in function_definition) = 0 then
    raise exception 'Expected create_seo_brief_handoff nullable provenance guard was not found.';
  end if;
  function_definition := replace(function_definition, original_guard, replacement_guard);
  execute function_definition;
end;
$$;

comment on function public.create_seo_brief_handoff(jsonb) is
  'Atomically creates a research-to-writer SEO brief, topic handoff, and draft research/rights packets. Service-role only; requires distinct labelled HTTPS evidence sources with non-blank YYYY-MM-DD access dates and claim text; never creates or publishes a page.';

commit;
