begin;

-- Disambiguate the computed packet checksum from the table column in the
-- rights-review update statement.
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

  function_definition := replace(function_definition, E'\n  packet_checksum text;', E'\n  computed_packet_checksum text;');
  function_definition := replace(function_definition, 'packet_checksum :=', 'computed_packet_checksum :=');
  function_definition := replace(function_definition, 'packet_checksum = packet_checksum,', 'packet_checksum = computed_packet_checksum,');

  execute function_definition;
end;
$$;

commit;
