begin;

create table if not exists public.billing_settings (
  singleton boolean primary key default true check (singleton),
  active_provider text not null check (active_provider in ('whop', 'stripe')),
  active_mode text not null check (active_mode in ('one_time', 'subscription')),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default timezone('utc', now())
);

insert into public.billing_settings (singleton, active_provider, active_mode)
values (true, 'whop', 'subscription')
on conflict (singleton) do nothing;

create table if not exists public.billing_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('whop', 'stripe')),
  provider_reference text not null check (char_length(provider_reference) between 1 and 160),
  provider_plan_id text not null check (char_length(provider_plan_id) between 1 and 160),
  plan_key text check (plan_key is null or plan_key in ('commercial', 'premium')),
  billing_mode text not null check (billing_mode in ('one_time', 'subscription')),
  status text not null check (char_length(status) between 1 and 40),
  provider_customer_id text,
  provider_payment_id text,
  checkout_session_id text,
  cancel_at_period_end boolean not null default false,
  access_expires_at timestamptz,
  has_access boolean generated always as (
    status in ('active', 'trialing', 'canceling')
    or (billing_mode = 'one_time' and status = 'completed')
  ) stored,
  last_event_id text not null check (char_length(last_event_id) between 1 and 160),
  last_event_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (provider, provider_reference)
);

create index if not exists billing_entitlements_user_access_idx
  on public.billing_entitlements (user_id, has_access, updated_at desc);
create index if not exists billing_entitlements_customer_idx
  on public.billing_entitlements (provider, provider_customer_id)
  where provider_customer_id is not null;

create table if not exists public.billing_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('whop', 'stripe')),
  event_id text not null check (char_length(event_id) between 1 and 160),
  event_type text not null check (char_length(event_type) between 1 and 100),
  occurred_at timestamptz not null,
  processed_at timestamptz not null default timezone('utc', now()),
  unique (provider, event_id)
);

create table if not exists public.stripe_transaction_facts (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique check (char_length(stripe_event_id) between 1 and 160),
  object_type text not null check (object_type in ('payment', 'refund', 'dispute')),
  stripe_object_id text not null check (char_length(stripe_object_id) between 1 and 160),
  event_type text not null check (char_length(event_type) between 1 and 100),
  user_id uuid,
  payment_intent_id text,
  checkout_session_id text,
  subscription_id text,
  plan_key text check (plan_key is null or plan_key in ('commercial', 'premium')),
  status text not null check (char_length(status) between 1 and 40),
  amount_cents bigint check (amount_cents is null or amount_cents >= 0),
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default timezone('utc', now())
);

create index if not exists stripe_transaction_facts_user_occurred_idx
  on public.stripe_transaction_facts (user_id, occurred_at desc)
  where user_id is not null;
create index if not exists stripe_transaction_facts_payment_intent_idx
  on public.stripe_transaction_facts (payment_intent_id, occurred_at desc)
  where payment_intent_id is not null;

alter table public.billing_settings enable row level security;
alter table public.billing_entitlements enable row level security;
alter table public.billing_webhook_events enable row level security;
alter table public.stripe_transaction_facts enable row level security;

drop policy if exists "Users can read their own billing entitlements" on public.billing_entitlements;
create policy "Users can read their own billing entitlements"
  on public.billing_entitlements for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.billing_settings from anon, authenticated;
revoke all on public.billing_entitlements from anon, authenticated;
revoke all on public.billing_webhook_events from anon, authenticated;
revoke all on public.stripe_transaction_facts from anon, authenticated;
grant select on public.billing_entitlements to authenticated;
grant select, insert, update on public.billing_settings to service_role;
grant select, insert, update on public.billing_entitlements to service_role;
grant select, insert on public.billing_webhook_events to service_role;
grant select, insert on public.stripe_transaction_facts to service_role;

create or replace function public.apply_billing_entitlement_event(
  p_user_id uuid,
  p_provider text,
  p_provider_reference text,
  p_provider_plan_id text,
  p_plan_key text,
  p_billing_mode text,
  p_status text,
  p_provider_customer_id text,
  p_provider_payment_id text,
  p_checkout_session_id text,
  p_cancel_at_period_end boolean,
  p_access_expires_at timestamptz,
  p_event_id text,
  p_event_type text,
  p_event_at timestamptz
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  inserted_event_id uuid;
begin
  insert into public.billing_webhook_events (provider, event_id, event_type, occurred_at)
  values (p_provider, p_event_id, p_event_type, p_event_at)
  on conflict (provider, event_id) do nothing
  returning id into inserted_event_id;

  if inserted_event_id is null then
    return false;
  end if;

  insert into public.billing_entitlements (
    user_id, provider, provider_reference, provider_plan_id, plan_key,
    billing_mode, status, provider_customer_id, provider_payment_id,
    checkout_session_id, cancel_at_period_end, access_expires_at,
    last_event_id, last_event_at, updated_at
  ) values (
    p_user_id, p_provider, p_provider_reference, p_provider_plan_id, p_plan_key,
    p_billing_mode, p_status, p_provider_customer_id, p_provider_payment_id,
    p_checkout_session_id, coalesce(p_cancel_at_period_end, false), p_access_expires_at,
    p_event_id, p_event_at, p_event_at
  )
  on conflict (provider, provider_reference) do update set
    user_id = excluded.user_id,
    provider_plan_id = excluded.provider_plan_id,
    plan_key = excluded.plan_key,
    billing_mode = excluded.billing_mode,
    status = excluded.status,
    provider_customer_id = coalesce(excluded.provider_customer_id, billing_entitlements.provider_customer_id),
    provider_payment_id = coalesce(excluded.provider_payment_id, billing_entitlements.provider_payment_id),
    checkout_session_id = coalesce(excluded.checkout_session_id, billing_entitlements.checkout_session_id),
    cancel_at_period_end = excluded.cancel_at_period_end,
    access_expires_at = excluded.access_expires_at,
    last_event_id = excluded.last_event_id,
    last_event_at = excluded.last_event_at,
    updated_at = excluded.updated_at
  where excluded.last_event_at >= billing_entitlements.last_event_at;

  return true;
end;
$$;

revoke all on function public.apply_billing_entitlement_event(uuid, text, text, text, text, text, text, text, text, text, boolean, timestamptz, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.apply_billing_entitlement_event(uuid, text, text, text, text, text, text, text, text, text, boolean, timestamptz, text, text, timestamptz) to service_role;

insert into public.billing_entitlements (
  user_id, provider, provider_reference, provider_plan_id, plan_key,
  billing_mode, status, last_event_id, last_event_at, created_at, updated_at
)
select
  user_id, 'whop', whop_membership_id, whop_plan_id, null,
  case when status = 'completed' then 'one_time' else 'subscription' end,
  status, last_event_id, updated_at, created_at, updated_at
from public.whop_entitlements
on conflict (provider, provider_reference) do nothing;

create or replace function public.prevent_stripe_transaction_fact_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'Stripe transaction facts are append-only; record a signed compensating event instead.';
end;
$$;

drop trigger if exists stripe_transaction_facts_immutable on public.stripe_transaction_facts;
create trigger stripe_transaction_facts_immutable
before update or delete on public.stripe_transaction_facts
for each row execute function public.prevent_stripe_transaction_fact_mutation();

revoke all on function public.prevent_stripe_transaction_fact_mutation() from public, anon, authenticated;

commit;
