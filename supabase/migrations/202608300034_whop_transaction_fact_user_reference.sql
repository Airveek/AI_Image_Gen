begin;

-- The revenue ledger is append-only. An auth-user deletion must therefore not
-- rewrite an existing fact through ON DELETE SET NULL (the immutability trigger
-- intentionally rejects that update). Keep the immutable, non-PII UUID snapshot
-- without a foreign key so account deletion can complete while revenue history
-- remains auditable. New webhook inserts still accept only validated UUIDs from
-- the application boundary.
alter table public.whop_transaction_facts
  drop constraint if exists whop_transaction_facts_user_id_fkey;

comment on column public.whop_transaction_facts.user_id is
  'Immutable non-PII Supabase user UUID snapshot; intentionally not an FK because account deletion must not mutate the append-only ledger.';

commit;
