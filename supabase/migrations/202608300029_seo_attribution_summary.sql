begin;

-- Aggregate first-party attribution without exposing user IDs or raw touch
-- paths to the dashboard. The attribution model remains directional: backend
-- user events and current Whop entitlement state are the conversion facts.
create or replace function public.get_seo_attribution_summary(since_date date)
returns jsonb
language sql
security invoker
set search_path = public
as $$
with event_facts as (
  select
    user_id,
    max((event_name = 'account_created')::int) as signups,
    max((event_name = 'generation_succeeded')::int) as first_generations,
    max((event_name = 'checkout_started')::int) as checkout_starts,
    max((event_name = 'membership_activated')::int) as activations
  from public.user_events
  where occurred_at >= since_date::timestamptz
  group by user_id
),
paid_facts as (
  select user_id, 1 as paid_users
  from public.whop_entitlements
  where status in ('trialing', 'active', 'completed')
  group by user_id
),
journeys as (
  select
    attribution.user_id,
    first_touch.source as first_source,
    first_touch.medium as first_medium,
    last_touch.source as last_source,
    last_touch.medium as last_medium,
    coalesce(events.signups, 0) as signups,
    coalesce(events.first_generations, 0) as first_generations,
    coalesce(events.checkout_starts, 0) as checkout_starts,
    coalesce(events.activations, 0) as activations,
    coalesce(paid.paid_users, 0) as paid_users
  from public.seo_user_attribution as attribution
  left join public.seo_touchpoints as first_touch
    on first_touch.id = attribution.first_touch_id
  left join public.seo_touchpoints as last_touch
    on last_touch.id = attribution.last_non_direct_touch_id
  left join event_facts as events
    on events.user_id = attribution.user_id
  left join paid_facts as paid
    on paid.user_id = attribution.user_id
),
first_touch_rows as (
  select
    first_source as source,
    first_medium as medium,
    count(*)::bigint as users,
    sum(signups)::bigint as signups,
    sum(first_generations)::bigint as first_generations,
    sum(checkout_starts)::bigint as checkout_starts,
    sum(activations)::bigint as activations,
    sum(paid_users)::bigint as paid_users
  from journeys
  where first_source is not null
  group by first_source, first_medium
  order by users desc, source, medium
  limit 50
),
last_non_direct_rows as (
  select
    last_source as source,
    last_medium as medium,
    count(*)::bigint as users,
    sum(signups)::bigint as signups,
    sum(first_generations)::bigint as first_generations,
    sum(checkout_starts)::bigint as checkout_starts,
    sum(activations)::bigint as activations,
    sum(paid_users)::bigint as paid_users
  from journeys
  where last_source is not null
  group by last_source, last_medium
  order by users desc, source, medium
  limit 50
)
select jsonb_build_object(
  'firstTouch', coalesce((
    select jsonb_agg(jsonb_build_object(
      'source', source,
      'medium', medium,
      'users', users,
      'signups', signups,
      'firstGenerations', first_generations,
      'checkoutStarts', checkout_starts,
      'activations', activations,
      'paidUsers', paid_users
    ) order by users desc, source, medium)
    from first_touch_rows
  ), '[]'::jsonb),
  'lastNonDirect', coalesce((
    select jsonb_agg(jsonb_build_object(
      'source', source,
      'medium', medium,
      'users', users,
      'signups', signups,
      'firstGenerations', first_generations,
      'checkoutStarts', checkout_starts,
      'activations', activations,
      'paidUsers', paid_users
    ) order by users desc, source, medium)
    from last_non_direct_rows
  ), '[]'::jsonb)
);
$$;

revoke all on function public.get_seo_attribution_summary(date) from public, anon, authenticated;
grant execute on function public.get_seo_attribution_summary(date) to service_role;

comment on function public.get_seo_attribution_summary(date) is
  'Bounded non-PII first-touch and last-non-direct conversion aggregates for the SEO dashboard.';

commit;
