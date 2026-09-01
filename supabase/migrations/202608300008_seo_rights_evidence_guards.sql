begin;

-- A status string is not proof of rights. Keep the evidence packet queryable
-- and reject every approved topic/run/asset that cannot point to a concrete
-- review record.
alter table public.seo_topics
  add column if not exists rights_evidence jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'seo_topics_rights_evidence_array_check'
      and conrelid = 'public.seo_topics'::regclass
  ) then
    alter table public.seo_topics
      add constraint seo_topics_rights_evidence_array_check
      check (jsonb_typeof(rights_evidence) = 'array');
  end if;
end;
$$;

create or replace function public.validate_seo_topic_rights_evidence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rights jsonb;
begin
  if new.rights_status <> 'approved' then
    return new;
  end if;

  if jsonb_typeof(new.demand_evidence) <> 'array' then
    raise exception 'Approved SEO topics require a rights evidence packet.';
  end if;

  select coalesce(jsonb_agg(item), '[]'::jsonb)
    into rights
    from jsonb_array_elements(new.demand_evidence) as entry(item)
   where item->>'type' = 'rights'
     and item->>'status' = 'approved'
     and coalesce(item->>'evidenceId', '') <> ''
     and coalesce(item->>'reviewer', '') <> ''
     and coalesce(item->>'reviewedAt', '') <> '';

  if jsonb_array_length(rights) = 0 then
    raise exception 'Approved SEO topics require type=rights, status=approved, evidenceId, reviewer, and reviewedAt.';
  end if;
  new.rights_evidence := rights;
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'seo_topics_rights_evidence'
      and tgrelid = 'public.seo_topics'::regclass
      and not tgisinternal
  ) then
    create trigger seo_topics_rights_evidence
    before insert or update on public.seo_topics
    for each row execute function public.validate_seo_topic_rights_evidence();
  end if;
end;
$$;

create or replace function public.validate_seo_generation_rights_evidence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if jsonb_typeof(new.source_asset) <> 'object'
     or coalesce(new.source_asset->>'rightsEvidenceId', '') = ''
     or coalesce(new.source_asset->>'rightsApproved', 'false') <> 'true' then
    raise exception 'SEO generation runs require an approved rightsEvidenceId and rightsApproved=true.';
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'seo_generation_runs_rights_evidence'
      and tgrelid = 'public.seo_generation_runs'::regclass
      and not tgisinternal
  ) then
    create trigger seo_generation_runs_rights_evidence
    before insert or update on public.seo_generation_runs
    for each row execute function public.validate_seo_generation_rights_evidence();
  end if;
end;
$$;

create or replace function public.validate_seo_asset_rights_evidence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.rights_status = 'approved'
     and (jsonb_typeof(new.generation_metadata) <> 'object'
       or coalesce(new.generation_metadata->>'rightsEvidenceId', '') = ''
       or coalesce(new.generation_metadata->>'rightsApproved', 'false') <> 'true') then
    raise exception 'Approved SEO assets require generation_metadata.rightsEvidenceId and rightsApproved=true.';
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'seo_assets_rights_evidence'
      and tgrelid = 'public.seo_assets'::regclass
      and not tgisinternal
  ) then
    create trigger seo_assets_rights_evidence
    before insert or update on public.seo_assets
    for each row execute function public.validate_seo_asset_rights_evidence();
  end if;
end;
$$;

comment on column public.seo_topics.rights_evidence is
  'Structured rights review records copied from demand_evidence; approved topics require an evidence ID, reviewer, and timestamp.';

commit;
