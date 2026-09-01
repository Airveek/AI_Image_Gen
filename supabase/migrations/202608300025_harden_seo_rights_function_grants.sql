begin;

-- These functions are row-level trigger guards. They must run when their
-- owning table changes, but they are not an application RPC surface. Keep
-- SECURITY DEFINER for the trigger's protected validation reads and remove
-- direct execution from API roles so an anonymous or signed-in caller cannot
-- invoke them through /rest/v1/rpc.
revoke all on function public.validate_seo_topic_rights_evidence() from public, anon, authenticated;
revoke all on function public.validate_seo_generation_rights_evidence() from public, anon, authenticated;
revoke all on function public.validate_seo_asset_rights_evidence() from public, anon, authenticated;
grant execute on function public.validate_seo_topic_rights_evidence() to service_role;
grant execute on function public.validate_seo_generation_rights_evidence() to service_role;
grant execute on function public.validate_seo_asset_rights_evidence() to service_role;

commit;
