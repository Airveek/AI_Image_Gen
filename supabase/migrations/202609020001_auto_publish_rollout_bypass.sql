begin;
-- The owner explicitly chose automatic publication for approved pages. Keep
-- rollout rows for audit/history, but make their manual-review state
-- informational instead of a publication blocker. The application still
-- enforces the technical, content-quality, link, render, and sitemap gates.
alter table public.seo_automation_config
  add column if not exists publish_review_bypass_enabled boolean not null default false;
comment on column public.seo_automation_config.publish_review_bypass_enabled is
  'When true, seo_template_rollouts manual_review/paused states do not block an already approved page. Technical, content, render, URL-state, and sitemap gates remain mandatory.';
update public.seo_automation_config
   set publish_review_bypass_enabled = true,
       updated_at = now()
 where id = true;
commit;
