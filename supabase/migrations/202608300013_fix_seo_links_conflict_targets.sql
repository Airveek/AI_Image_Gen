begin;

-- The ingest function has local `target_page_id` and `link_type` variables.
-- Resolve the two link upserts by named constraint so linting cannot treat
-- those local names as conflict-target expressions.
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
    'on conflict (source_page_id, target_page_id, link_type) do update set',
    'on conflict on constraint seo_links_source_page_id_target_page_id_link_type_key do update set'
  );

  execute source_sql;
end;
$$;

comment on function public.ingest_seo_page_draft(jsonb) is
  'Atomically imports a validated, non-live SEO draft and its evidence graph; service-role only. Lint-safe link upserts.';

commit;
