begin;
-- Do not recreate obsolete manual-review rows while automatic publication is
-- enabled. The table remains available if the operator later disables the
-- bypass for a deliberate rollback.
create or replace function public.ensure_seo_template_rollout()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.seo_automation_config
    where id = true
      and publish_review_bypass_enabled = true
  ) then
    return new;
  end if;

  insert into public.seo_template_rollouts (template_version)
  values (new.template_version)
  on conflict (template_version) do nothing;
  return new;
end;
$$;
revoke all on function public.ensure_seo_template_rollout() from public, anon, authenticated;
grant execute on function public.ensure_seo_template_rollout() to service_role;
delete from public.seo_template_rollouts
where status = 'manual_review';
commit;
