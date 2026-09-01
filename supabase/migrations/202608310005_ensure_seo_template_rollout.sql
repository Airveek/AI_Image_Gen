begin;

-- Every page template must have an explicit rollout record. Creating the row
-- automatically keeps new templates visible to the control plane while
-- preserving the mandatory manual-review state. This trigger never promotes a
-- template to `proven` and never changes a page's indexability.
create or replace function public.ensure_seo_template_rollout()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.seo_template_rollouts (template_version)
  values (new.template_version)
  on conflict (template_version) do nothing;
  return new;
end;
$$;

drop trigger if exists seo_pages_ensure_template_rollout on public.seo_pages;
create trigger seo_pages_ensure_template_rollout
after insert on public.seo_pages
for each row
execute function public.ensure_seo_template_rollout();

revoke all on function public.ensure_seo_template_rollout() from public, anon, authenticated;
grant execute on function public.ensure_seo_template_rollout() to service_role;

comment on function public.ensure_seo_template_rollout() is
  'Creates a manual-review rollout row for newly introduced SEO page templates; never promotes or publishes a template.';

commit;
