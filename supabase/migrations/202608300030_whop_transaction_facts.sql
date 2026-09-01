begin;

-- Immutable, service-role-only payment/refund facts from signed Whop
-- webhooks. This is the revenue truth layer; GA4 remains the behavioral
-- and pre-payment measurement layer. The table intentionally excludes raw
-- webhook payloads, addresses, card data, email addresses, and other PII.
create table if not exists public.whop_transaction_facts (
  id uuid primary key default gen_random_uuid(),
  whop_event_id text not null unique check (char_length(whop_event_id) between 8 and 160),
  object_type text not null check (object_type in ('payment', 'refund')),
  whop_object_id text not null check (char_length(whop_object_id) between 1 and 160),
  event_type text not null check (event_type in (
    'payment.created',
    'payment.pending',
    'payment.succeeded',
    'payment.failed',
    'refund.created',
    'refund.updated'
  )),
  user_id uuid references auth.users(id) on delete set null,
  payment_id text,
  refund_id text,
  membership_id text,
  plan_id text,
  checkout_configuration_id text,
  status text not null check (char_length(status) between 1 and 40),
  amount numeric(18, 4) check (amount is null or amount >= 0),
  amount_after_fees numeric(18, 4) check (amount_after_fees is null or amount_after_fees >= 0),
  usd_amount numeric(18, 4) check (usd_amount is null or usd_amount >= 0),
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  settlement_currency text check (settlement_currency is null or settlement_currency ~ '^[A-Z]{3}$'),
  tax_amount numeric(18, 4) check (tax_amount is null or tax_amount >= 0),
  refunded_amount numeric(18, 4) check (refunded_amount is null or refunded_amount >= 0),
  occurred_at timestamptz not null,
  received_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists whop_transaction_facts_user_occurred_idx
  on public.whop_transaction_facts (user_id, occurred_at desc)
  where user_id is not null;
create index if not exists whop_transaction_facts_object_idx
  on public.whop_transaction_facts (object_type, whop_object_id);
create index if not exists whop_transaction_facts_event_type_idx
  on public.whop_transaction_facts (event_type, occurred_at desc);

alter table public.whop_transaction_facts enable row level security;
revoke all on public.whop_transaction_facts from anon, authenticated;
grant select, insert, update on public.whop_transaction_facts to service_role;

comment on table public.whop_transaction_facts is
  'Immutable non-PII payment and refund facts from verified Whop webhooks; source of truth for revenue reconciliation.';

commit;
