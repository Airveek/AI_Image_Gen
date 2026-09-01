begin;

-- Keep the trusted webhook writer limited to the operations it actually uses.
-- The append-only trigger remains the second line of defense for accidental
-- updates/deletes by privileged database owners.
revoke all on public.whop_transaction_facts from service_role;
grant select, insert on public.whop_transaction_facts to service_role;

commit;
