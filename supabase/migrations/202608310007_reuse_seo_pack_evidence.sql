begin;

-- A product pack is deliberately reused by its listing, lifestyle, detail,
-- hub, and prompt pages. The same verified capture therefore must not be
-- rejected merely because a second page references it. Keep the checksum
-- indexed for lookup, and enforce that a repeated topic/job/checksum can only
-- carry identical immutable evidence fields.
alter table public.seo_generation_runs
  drop constraint if exists seo_generation_runs_kit_checksum_key;

create index if not exists seo_generation_runs_kit_checksum_idx
  on public.seo_generation_runs (kit_checksum);

create or replace function public.enforce_seo_generation_checksum_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
volatile
as $$
declare
  prior record;
begin
  select r.prompt, r.source_asset, r.settings, r.negative_constraints,
         r.kit_path, r.qa_status, r.creator_route, r.arena_id
    into prior
    from public.seo_generation_runs r
   where r.topic_id = new.topic_id
     and r.image_job = new.image_job
     and r.kit_checksum = new.kit_checksum
   order by r.created_at asc
   limit 1;

  if found and (
    prior.prompt is distinct from new.prompt
    or prior.source_asset is distinct from new.source_asset
    or prior.settings is distinct from new.settings
    or prior.negative_constraints is distinct from new.negative_constraints
    or prior.kit_path is distinct from new.kit_path
    or prior.qa_status is distinct from new.qa_status
    or prior.creator_route is distinct from new.creator_route
    or prior.arena_id is distinct from new.arena_id
  ) then
    raise exception 'SEO generation checksum is already bound to different evidence for this topic/job.';
  end if;

  return new;
end;
$$;

drop trigger if exists seo_generation_checksum_identity on public.seo_generation_runs;
create trigger seo_generation_checksum_identity
before insert on public.seo_generation_runs
for each row execute function public.enforce_seo_generation_checksum_identity();

revoke all on function public.enforce_seo_generation_checksum_identity() from public, anon, authenticated;
grant execute on function public.enforce_seo_generation_checksum_identity() to service_role;

comment on index public.seo_generation_runs_kit_checksum_idx is
  'Lookup index for immutable capture checksums; a verified product-pack capture may be referenced by multiple derivative pages.';

commit;
