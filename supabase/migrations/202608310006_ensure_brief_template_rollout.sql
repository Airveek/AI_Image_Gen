begin;

-- Briefs are the first durable record that names a template version. Register
-- it at that boundary as well as at page creation so the admin control plane
-- can show a complete rollout inventory before any draft exists. Existing
-- rows are only backfilled into the default manual-review state.
insert into public.seo_template_rollouts (template_version)
select distinct b.template_version
from public.seo_content_briefs b
where b.template_version is not null
on conflict (template_version) do nothing;

drop trigger if exists seo_content_briefs_ensure_template_rollout on public.seo_content_briefs;
create trigger seo_content_briefs_ensure_template_rollout
after insert on public.seo_content_briefs
for each row
execute function public.ensure_seo_template_rollout();

comment on trigger seo_content_briefs_ensure_template_rollout on public.seo_content_briefs is
  'Ensures every brief template version has a manual-review rollout row before draft creation.';

commit;
