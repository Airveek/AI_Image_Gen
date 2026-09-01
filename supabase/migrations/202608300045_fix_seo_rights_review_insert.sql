begin;

-- Correct the one remaining local-variable replacement in the rights-review
-- function. The column list must stay packet_id, while the values expression
-- must use the renamed rights_packet_id variable.
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

  function_definition := replace(function_definition, E'\n      rights_packet_id, item_key, item_type', E'\n      packet_id, item_key, item_type');
  function_definition := replace(function_definition, E') values (\n      packet_id, p_item_key', E') values (\n      rights_packet_id, p_item_key');

  execute function_definition;
end;
$$;

commit;
