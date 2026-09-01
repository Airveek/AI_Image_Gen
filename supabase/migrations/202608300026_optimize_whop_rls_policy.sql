begin;

-- Evaluate the request identity once per statement instead of once per row.
-- The predicate is otherwise unchanged: signed-in users can read only their
-- own entitlement rows.
drop policy if exists "Users can read their own Whop entitlements" on public.whop_entitlements;
create policy "Users can read their own Whop entitlements"
  on public.whop_entitlements
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

commit;
