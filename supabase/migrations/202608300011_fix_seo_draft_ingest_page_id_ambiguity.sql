begin;

-- The ingest function intentionally uses local variables named page_id in
-- several INSERT value lists. Tell PL/pgSQL to resolve those ambiguous
-- references to the local variable rather than a same-named target column.
do $$
declare
  source_sql text;
begin
  select pg_get_functiondef(p.oid)
    into source_sql
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.oid = 'public.ingest_seo_page_draft(jsonb)'::regprocedure;

  if source_sql is null then
    raise exception 'Expected public.ingest_seo_page_draft(jsonb) to exist.';
  end if;

  if position('#variable_conflict use_variable' in source_sql) = 0 then
    source_sql := replace(
      source_sql,
      E'AS $function$\ndeclare',
      E'AS $function$\n#variable_conflict use_variable\ndeclare'
    );
  end if;

  execute source_sql;
end;
$$;

comment on function public.ingest_seo_page_draft(jsonb) is
  'Atomically imports a validated, non-live SEO draft and its evidence graph; service-role only. Lint-safe variable conflict resolution.';

commit;
