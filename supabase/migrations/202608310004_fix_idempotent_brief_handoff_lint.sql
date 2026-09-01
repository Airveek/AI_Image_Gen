begin;

-- 202608310003 was applied before its PL/pgSQL variable was renamed. Rewrite
-- the deployed function definition in-place so the brief-key variable cannot
-- be confused with the table column by Supabase's SQL linter.
do $$
declare
  function_definition text;
begin
  select pg_get_functiondef('public.create_seo_brief_handoff(jsonb)'::regprocedure)
    into function_definition;
  if function_definition is null then
    raise exception 'Expected create_seo_brief_handoff was not found.';
  end if;
  if position('brief_key text;' in function_definition) > 0 then
    function_definition := replace(function_definition, 'brief_key text;', 'brief_key_value text;');
    function_definition := replace(function_definition, 'brief_key := nullif(', 'brief_key_value := nullif(');
    function_definition := replace(function_definition, 'if brief_key is null or brief_key !~', 'if brief_key_value is null or brief_key_value !~');
    function_definition := replace(function_definition, 'where b.brief_key = brief_key', 'where b.brief_key = brief_key_value');
    function_definition := replace(function_definition, $replace$different identity: %.', brief_key;$replace$, $replace$different identity: %.', brief_key_value;$replace$);
    function_definition := replace(function_definition, $replace$'briefKey', brief_key$replace$, $replace$'briefKey', brief_key_value$replace$);
    function_definition := replace(function_definition, '    brief_key, topic_id, topic_locale,', '    brief_key_value, topic_id, topic_locale,');
  elsif position('brief_key_value text;' in function_definition) = 0 then
    raise exception 'Expected the 202608310003 brief-key declaration was not found.';
  end if;
  execute function_definition;
end;
$$;

revoke all on function public.create_seo_brief_handoff(jsonb) from public, anon, authenticated;
grant execute on function public.create_seo_brief_handoff(jsonb) to service_role;

commit;
