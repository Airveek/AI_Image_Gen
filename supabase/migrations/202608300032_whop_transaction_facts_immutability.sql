begin;

-- Payment/refund facts are an append-only revenue ledger. Corrections must be
-- represented by a later signed Whop event, never by rewriting history.
create or replace function public.prevent_whop_transaction_fact_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Whop transaction facts are append-only; record a compensating signed event instead.';
end;
$$;

drop trigger if exists whop_transaction_facts_immutable on public.whop_transaction_facts;
create trigger whop_transaction_facts_immutable
before update or delete on public.whop_transaction_facts
for each row execute function public.prevent_whop_transaction_fact_mutation();

revoke update, delete on public.whop_transaction_facts from anon, authenticated, service_role;
grant select, insert on public.whop_transaction_facts to service_role;
revoke all on function public.prevent_whop_transaction_fact_mutation() from public, anon, authenticated;

comment on function public.prevent_whop_transaction_fact_mutation() is
  'Prevents mutation of the verified Whop payment/refund ledger; corrections use signed compensating events.';

commit;
