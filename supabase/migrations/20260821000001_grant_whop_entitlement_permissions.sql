grant select on public.whop_entitlements to authenticated;

grant select, insert, update on public.whop_entitlements to service_role;

grant usage, select on sequence public.whop_entitlements_id_seq to service_role;

