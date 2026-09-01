begin;

-- Migration 006 pre-dates the rights-evidence guard and used a PL/pgSQL
-- variable named `locale`, which is ambiguous inside the `seo_topics`
-- INSERT ... ON CONFLICT statement on current Supabase linting. Recompile
-- the already-deployed function in place without replaying its data writes.
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

  source_sql := replace(
    source_sql,
    E'AS $function$\ndeclare',
    E'AS $function$\n#variable_conflict use_variable\ndeclare'
  );
  source_sql := replace(source_sql, E'\n  locale text :=', E'\n  v_locale text :=');
  source_sql := replace(
    source_sql,
    'image_jobs text[] := ''{}'';',
    'image_jobs text[] := ''{}''::text[];'
  );
  source_sql := replace(source_sql, E'\n    locale,\n', E'\n    v_locale,\n');

  execute source_sql;
end;
$$;

comment on function public.ingest_seo_page_draft(jsonb) is
  'Atomically imports a validated, non-live SEO draft and its evidence graph; service-role only. Lint-safe locale variable.';

commit;
