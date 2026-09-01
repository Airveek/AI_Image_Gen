begin;

-- With `#variable_conflict use_variable`, PL/pgSQL can interpret the
-- `page_id` conflict target as the local variable. Use the named unique
-- constraint so the upsert remains unambiguous and lintable.
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
    'on conflict (page_id, url) do update set',
    'on conflict on constraint seo_sources_page_id_url_key do update set'
  );

  execute source_sql;
end;
$$;

comment on function public.ingest_seo_page_draft(jsonb) is
  'Atomically imports a validated, non-live SEO draft and its evidence graph; service-role only. Lint-safe conflict target.';

commit;
