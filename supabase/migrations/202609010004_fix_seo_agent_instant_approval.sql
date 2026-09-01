begin;

-- 003 was applied before the function was exercised against the production
-- schema. Its quality-run SELECT used an unqualified `blockers` identifier,
-- which conflicts with the function-local approval blocker array in some
-- Postgres configurations. Recreate the exact function definition with the
-- quality-run table qualified, without touching any data or approval state.
do $$
declare
  definition text;
  repaired text;
begin
  select pg_get_functiondef('public.auto_approve_seo_agent_draft(uuid,uuid)'::regprocedure)
    into definition;
  if definition is null then
    raise exception 'Instant SEO approval function is missing.';
  end if;
  repaired := replace(definition, 'select status, score, blockers', 'select qr.status, qr.score, qr.blockers');
  repaired := replace(repaired, 'from public.seo_quality_runs', 'from public.seo_quality_runs qr');
  if repaired = definition then
    raise exception 'Instant SEO approval function repair did not find the expected quality query.';
  end if;
  execute repaired;
end;
$$;

comment on function public.auto_approve_seo_agent_draft(uuid, uuid) is
  'Atomically records instant editorial approval for a completed Airveek SEO agent draft after deterministic checks. It never publishes or changes indexability.';

commit;
