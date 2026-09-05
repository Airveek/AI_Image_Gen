begin;
-- The rollout table is no longer an approval queue in reader-first autopilot
-- mode. Remove the old manual-review rows so the operations screen and the
-- database no longer present an obsolete action. The table and its trigger
-- remain available for audit/rollback compatibility; the active bypass keeps
-- any future legacy row non-blocking.
delete from public.seo_template_rollouts
where status = 'manual_review';
commit;
