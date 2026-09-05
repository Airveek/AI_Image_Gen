begin;

alter table public.seo_touchpoints
  add column if not exists utm_content text,
  add column if not exists utm_term text,
  add column if not exists fbclid text,
  add column if not exists fbp text,
  add column if not exists fbc text;

alter table public.creator_assets
  add column if not exists generation_attempt_id uuid;

create unique index if not exists creator_assets_generation_attempt_idx
  on public.creator_assets (generation_attempt_id)
  where generation_attempt_id is not null;

create table if not exists public.creator_credit_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted smallint not null default 2 check (granted >= 0),
  used smallint not null default 0 check (used >= 0 and used <= granted),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.creator_generation_credit_reservations (
  attempt_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_id uuid references public.creator_assets(id) on delete set null,
  uses_free_credit boolean not null default true,
  status text not null check (status in ('reserved', 'consumed', 'released')),
  reserved_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists creator_credit_reservations_user_status_idx
  on public.creator_generation_credit_reservations (user_id, status, reserved_at);

insert into public.creator_credit_accounts (user_id, granted, used)
select
  users.id,
  2,
  least(2, count(assets.id))::smallint
from auth.users users
left join public.creator_assets assets
  on assets.user_id = users.id
  and assets.kind = 'generation'
  and assets.status = 'ready'
group by users.id
on conflict (user_id) do nothing;

create or replace function public.create_creator_credit_account()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.creator_credit_accounts (user_id, granted, used)
  values (new.id, 2, 0)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists create_creator_credit_account_after_signup on auth.users;
create trigger create_creator_credit_account_after_signup
after insert on auth.users
for each row execute function public.create_creator_credit_account();

create or replace function public.release_stale_generation_credit_reservations(p_user_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  released_count integer;
begin
  with completed as (
    update public.creator_generation_credit_reservations reservations
    set status = 'consumed', asset_id = assets.id, updated_at = timezone('utc', now())
    from public.creator_assets assets
    where reservations.status = 'reserved'
      and reservations.reserved_at < timezone('utc', now()) - interval '20 minutes'
      and (p_user_id is null or reservations.user_id = p_user_id)
      and assets.user_id = reservations.user_id
      and assets.generation_attempt_id = reservations.attempt_id
      and assets.kind = 'generation'
      and assets.status = 'ready'
    returning reservations.user_id, reservations.uses_free_credit
  ), charges as (
    select user_id, count(*)::integer as credit_count
    from completed
    where uses_free_credit
    group by user_id
  )
  update public.creator_credit_accounts accounts
  set used = least(accounts.granted, accounts.used + charges.credit_count),
      updated_at = timezone('utc', now())
  from charges
  where accounts.user_id = charges.user_id;

  update public.creator_assets assets
  set status = 'failed', error_code = 'provider_timeout', updated_at = timezone('utc', now())
  where assets.kind = 'generation'
    and assets.status = 'processing'
    and exists (
      select 1 from public.creator_generation_credit_reservations reservations
      where reservations.attempt_id = assets.generation_attempt_id
        and reservations.status = 'reserved'
        and reservations.reserved_at < timezone('utc', now()) - interval '20 minutes'
        and (p_user_id is null or reservations.user_id = p_user_id)
    );

  update public.creator_generation_credit_reservations reservations
  set status = 'released', updated_at = timezone('utc', now())
  where reservations.status = 'reserved'
    and reservations.reserved_at < timezone('utc', now()) - interval '20 minutes'
    and (p_user_id is null or reservations.user_id = p_user_id);
  get diagnostics released_count = row_count;
  return released_count;
end;
$$;

create or replace function public.reserve_creator_generation_credit(p_user_id uuid, p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  account_row public.creator_credit_accounts%rowtype;
  reservation_row public.creator_generation_credit_reservations%rowtype;
  reserved_count integer;
  remaining_count integer;
  has_paid_access boolean;
begin
  perform public.release_stale_generation_credit_reservations(p_user_id);

  insert into public.creator_credit_accounts (user_id, granted, used)
  select
    p_user_id,
    2,
    least(2, count(assets.id))::smallint
  from public.creator_assets assets
  where assets.user_id = p_user_id
    and assets.kind = 'generation'
    and assets.status = 'ready'
  on conflict (user_id) do nothing;

  select * into account_row
  from public.creator_credit_accounts
  where user_id = p_user_id
  for update;

  if account_row.user_id is null then
    raise exception 'Creator credit account could not be initialized.';
  end if;

  select coalesce(bool_or(entitlements.has_access), false)
  into has_paid_access
  from public.billing_entitlements entitlements
  where entitlements.user_id = p_user_id;

  select * into reservation_row
  from public.creator_generation_credit_reservations
  where attempt_id = p_attempt_id;

  select count(*)::integer into reserved_count
  from public.creator_generation_credit_reservations
  where user_id = p_user_id and status = 'reserved' and uses_free_credit;

  remaining_count := greatest(0, account_row.granted - account_row.used - reserved_count);

  if reservation_row.attempt_id is not null then
    if reservation_row.user_id <> p_user_id then
      raise exception 'Generation attempt belongs to another account.';
    end if;
    return jsonb_build_object(
      'state', case when reservation_row.status = 'reserved' then 'in_progress' else reservation_row.status end,
      'paid', has_paid_access,
      'granted', account_row.granted,
      'used', account_row.used,
      'reserved', reserved_count,
      'remaining', remaining_count
    );
  end if;

  if has_paid_access then
    insert into public.creator_generation_credit_reservations (attempt_id, user_id, uses_free_credit, status)
    values (p_attempt_id, p_user_id, false, 'reserved');
    return jsonb_build_object(
      'state', 'paid', 'paid', true, 'granted', account_row.granted,
      'used', account_row.used, 'reserved', reserved_count, 'remaining', remaining_count
    );
  end if;

  if remaining_count <= 0 then
    return jsonb_build_object(
      'state', 'exhausted', 'paid', false, 'granted', account_row.granted,
      'used', account_row.used, 'reserved', reserved_count, 'remaining', 0
    );
  end if;

  insert into public.creator_generation_credit_reservations (attempt_id, user_id, status)
  values (p_attempt_id, p_user_id, 'reserved');

  return jsonb_build_object(
    'state', 'reserved', 'paid', false, 'granted', account_row.granted,
    'used', account_row.used, 'reserved', reserved_count + 1,
    'remaining', greatest(0, remaining_count - 1)
  );
end;
$$;

create or replace function public.consume_creator_generation_credit(p_user_id uuid, p_attempt_id uuid, p_asset_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  reservation_status text;
  charge_free_credit boolean;
begin
  select status, uses_free_credit into reservation_status, charge_free_credit
  from public.creator_generation_credit_reservations
  where attempt_id = p_attempt_id and user_id = p_user_id
  for update;

  if reservation_status is null then
    return false;
  end if;
  if reservation_status = 'consumed' then
    return true;
  end if;
  if reservation_status <> 'reserved' then
    return false;
  end if;
  if not exists (
    select 1 from public.creator_assets
    where id = p_asset_id and user_id = p_user_id and status = 'ready'
      and generation_attempt_id = p_attempt_id
  ) then
    return false;
  end if;

  if charge_free_credit then
    update public.creator_credit_accounts
    set used = least(granted, used + 1), updated_at = timezone('utc', now())
    where user_id = p_user_id;
  end if;

  update public.creator_generation_credit_reservations
  set status = 'consumed', asset_id = p_asset_id, updated_at = timezone('utc', now())
  where attempt_id = p_attempt_id;
  return true;
end;
$$;

create or replace function public.release_creator_generation_credit(p_user_id uuid, p_attempt_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.creator_generation_credit_reservations
  set status = 'released', updated_at = timezone('utc', now())
  where attempt_id = p_attempt_id and user_id = p_user_id and status = 'reserved';
  return found;
end;
$$;

create table if not exists public.funnel_events (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique,
  event_name text not null check (event_name in (
    'PageView', 'ViewContent', 'CompleteRegistration', 'InitiateCheckout', 'Purchase',
    'LandingPageCTA', 'PlaygroundView', 'GenerationIntent', 'ModelReferenceUploaded',
    'ProductImageUploaded', 'FashionShootConfigured', 'GenerationStarted',
    'GenerationSucceeded', 'FreeGenerationUsed', 'PaywallView', 'PricingView',
    'LifetimeOfferClick'
  )),
  user_id uuid references auth.users(id) on delete set null,
  anonymous_id_hash text,
  source text,
  medium text,
  campaign text,
  properties jsonb not null default '{}'::jsonb check (jsonb_typeof(properties) = 'object'),
  occurred_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists funnel_events_name_occurred_idx
  on public.funnel_events (event_name, occurred_at desc);
create index if not exists funnel_events_campaign_occurred_idx
  on public.funnel_events (campaign, occurred_at desc)
  where campaign is not null;

create table if not exists public.meta_event_outbox (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique,
  event_name text not null check (event_name in (
    'ViewContent', 'CompleteRegistration', 'GenerationSucceeded',
    'PaywallView', 'InitiateCheckout', 'Purchase'
  )),
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed')),
  attempts smallint not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default timezone('utc', now()),
  occurred_at timestamptz not null,
  user_id uuid references auth.users(id) on delete set null,
  anonymous_id_hash text,
  source_url text not null,
  user_data jsonb not null default '{}'::jsonb check (jsonb_typeof(user_data) = 'object'),
  custom_data jsonb not null default '{}'::jsonb check (jsonb_typeof(custom_data) = 'object'),
  last_error text,
  delivered_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists meta_event_outbox_delivery_idx
  on public.meta_event_outbox (status, next_attempt_at)
  where status in ('pending', 'failed');

create table if not exists public.billing_checkout_attempts (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_key text not null check (plan_key in ('commercial', 'premium')),
  provider text not null check (provider in ('whop', 'stripe')),
  billing_mode text not null check (billing_mode in ('one_time', 'subscription')),
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  anonymous_id_hash text,
  marketing_consent boolean not null default false,
  attribution jsonb not null default '{}'::jsonb check (jsonb_typeof(attribution) = 'object'),
  meta_user_data jsonb not null default '{}'::jsonb check (jsonb_typeof(meta_user_data) = 'object'),
  initiate_checkout_event_id uuid not null unique,
  purchase_event_id uuid not null unique,
  provider_checkout_id text,
  purchase_url text,
  purchase_provider_reference text,
  verified_payment_at timestamptz,
  verified_amount_cents integer check (verified_amount_cents is null or verified_amount_cents >= 0),
  verified_currency text check (verified_currency is null or verified_currency ~ '^[A-Z]{3}$'),
  purchased_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, id)
);

create unique index if not exists billing_checkout_purchase_reference_idx
  on public.billing_checkout_attempts (provider, purchase_provider_reference)
  where purchase_provider_reference is not null;

create or replace function public.protect_billing_checkout_attempt_snapshot()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.user_id is distinct from old.user_id
    or new.plan_key is distinct from old.plan_key
    or new.provider is distinct from old.provider
    or new.billing_mode is distinct from old.billing_mode
    or new.amount_cents is distinct from old.amount_cents
    or new.currency is distinct from old.currency
    or new.anonymous_id_hash is distinct from old.anonymous_id_hash
    or new.marketing_consent is distinct from old.marketing_consent
    or new.attribution is distinct from old.attribution
    or new.initiate_checkout_event_id is distinct from old.initiate_checkout_event_id
    or new.purchase_event_id is distinct from old.purchase_event_id then
    raise exception 'Billing checkout attempt snapshots are immutable.';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_billing_checkout_attempt_snapshot_before_update on public.billing_checkout_attempts;
create trigger protect_billing_checkout_attempt_snapshot_before_update
before update on public.billing_checkout_attempts
for each row execute function public.protect_billing_checkout_attempt_snapshot();

alter table public.creator_credit_accounts enable row level security;
alter table public.creator_generation_credit_reservations enable row level security;
alter table public.funnel_events enable row level security;
alter table public.meta_event_outbox enable row level security;
alter table public.billing_checkout_attempts enable row level security;

revoke all on public.creator_credit_accounts from anon, authenticated;
revoke all on public.creator_generation_credit_reservations from anon, authenticated;
revoke all on public.funnel_events from anon, authenticated;
revoke all on public.meta_event_outbox from anon, authenticated;
revoke all on public.billing_checkout_attempts from anon, authenticated;

grant select, insert, update on public.creator_credit_accounts to service_role;
grant select, insert, update on public.creator_generation_credit_reservations to service_role;
grant select, insert on public.funnel_events to service_role;
grant select, insert, update on public.meta_event_outbox to service_role;
grant select, insert, update on public.billing_checkout_attempts to service_role;

revoke all on function public.create_creator_credit_account() from public, anon, authenticated;
revoke all on function public.release_stale_generation_credit_reservations(uuid) from public, anon, authenticated;
revoke all on function public.reserve_creator_generation_credit(uuid, uuid) from public, anon, authenticated;
revoke all on function public.consume_creator_generation_credit(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.release_creator_generation_credit(uuid, uuid) from public, anon, authenticated;
revoke all on function public.protect_billing_checkout_attempt_snapshot() from public, anon, authenticated;
grant execute on function public.release_stale_generation_credit_reservations(uuid) to service_role;
grant execute on function public.reserve_creator_generation_credit(uuid, uuid) to service_role;
grant execute on function public.consume_creator_generation_credit(uuid, uuid, uuid) to service_role;
grant execute on function public.release_creator_generation_credit(uuid, uuid) to service_role;

commit;
