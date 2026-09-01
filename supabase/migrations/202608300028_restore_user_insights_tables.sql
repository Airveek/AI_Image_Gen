-- The historical user_insights migration is recorded as applied in some
-- environments even though its two tables are absent from the live schema.
-- Restore them idempotently so generation, auth, checkout, and admin
-- analytics do not silently lose events. This migration is intentionally
-- additive: it does not alter existing tables or rows.
begin;

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  user_type text check (
    user_type is null or user_type in ('brand-owner', 'designer', 'agency', 'marketer', 'hobbyist', 'other')
  ),
  primary_goal text check (
    primary_goal is null or primary_goal in ('product-photos', 'social-content', 'client-work', 'storybook', 'sketches', 'other')
  ),
  industry text check (industry is null or char_length(industry) between 1 and 80),
  target_market text check (target_market is null or char_length(target_market) between 1 and 80),
  first_touch_source text check (first_touch_source is null or char_length(first_touch_source) between 1 and 120),
  first_touch_medium text check (first_touch_medium is null or char_length(first_touch_medium) between 1 and 120),
  first_touch_campaign text check (first_touch_campaign is null or char_length(first_touch_campaign) between 1 and 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.user_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_name text not null check (
    event_name in (
      'account_created',
      'login_succeeded',
      'checkout_started',
      'membership_activated',
      'membership_deactivated',
      'generation_requested',
      'generation_succeeded',
      'generation_failed'
    )
  ),
  occurred_at timestamptz not null default now(),
  arena_id text check (arena_id is null or arena_id in ('general-image', 'product-fashion', 'storybook-page', 'image-to-sketch')),
  plan_key text check (plan_key is null or plan_key in ('commercial', 'premium')),
  properties jsonb not null default '{}'::jsonb,
  external_event_id text unique,
  created_at timestamptz not null default now()
);

create index if not exists user_profiles_updated_at_idx
  on public.user_profiles (updated_at desc);

create index if not exists user_events_user_occurred_idx
  on public.user_events (user_id, occurred_at desc);

create index if not exists user_events_name_occurred_idx
  on public.user_events (event_name, occurred_at desc);

create index if not exists user_events_arena_occurred_idx
  on public.user_events (arena_id, occurred_at desc)
  where arena_id is not null;

create index if not exists user_events_plan_occurred_idx
  on public.user_events (plan_key, occurred_at desc)
  where plan_key is not null;

alter table public.user_profiles enable row level security;
alter table public.user_events enable row level security;

drop policy if exists "Users can read their own profile" on public.user_profiles;
create policy "Users can read their own profile"
  on public.user_profiles
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own profile" on public.user_profiles;
create policy "Users can create their own profile"
  on public.user_profiles
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own profile" on public.user_profiles;
create policy "Users can update their own profile"
  on public.user_profiles
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own profile" on public.user_profiles;
create policy "Users can delete their own profile"
  on public.user_profiles
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.user_profiles from anon;
revoke all on public.user_events from anon, authenticated;
grant select, insert, update, delete on public.user_profiles to authenticated;
grant select, insert, update, delete on public.user_profiles to service_role;
grant select, insert on public.user_events to service_role;

commit;
