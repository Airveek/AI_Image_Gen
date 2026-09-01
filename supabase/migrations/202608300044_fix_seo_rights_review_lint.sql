begin;

-- The initial rights-review function used packet_id for both a local variable
-- and qualified table columns. Replace only the local references in the
-- already-installed function definition; qualified ei.packet_id/rd.packet_id
-- column names remain unchanged.
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

  function_definition := replace(function_definition, E'\n  packet_id uuid;', E'\n  rights_packet_id uuid;');
  function_definition := replace(function_definition, 'into packet_id,', 'into rights_packet_id,');
  function_definition := replace(function_definition, ' = packet_id', ' = rights_packet_id');
  function_definition := replace(function_definition, E'\n      packet_id, item_key', E'\n      rights_packet_id, item_key');
  function_definition := replace(function_definition, E'\n      p_brief_id, packet_id,', E'\n      p_brief_id, rights_packet_id,');
  function_definition := replace(function_definition, '''evidence_packet'', packet_id,', '''evidence_packet'', rights_packet_id,');
  function_definition := replace(function_definition, '''packetId'', packet_id', '''packetId'', rights_packet_id');

  execute function_definition;
end;
$$;

commit;
