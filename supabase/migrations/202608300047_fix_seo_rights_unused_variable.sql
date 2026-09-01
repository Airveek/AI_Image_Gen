begin;

-- Remove an unused declaration from the rights-review function so production
-- lint remains warning-free.
do $$
declare
  function_definition text;
begin
  select pg_get_functiondef(p.oid)
    into function_definition
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'review_seo_rights'
     and p.pronargs = 11;

  if function_definition is null then
    raise exception 'SEO rights-review function is missing.';
  end if;

  function_definition := replace(function_definition, E'\n  existing_review jsonb;', '');

  execute function_definition;
end;
$$;

commit;
