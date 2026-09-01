begin;

-- Keep the generation record self-describing. The source_asset JSON remains
-- the immutable evidence packet, while these columns make provider/model and
-- output provenance queryable without loading the packet into application
-- memory.
alter table public.seo_generation_runs
  add column if not exists provider text,
  add column if not exists model text,
  add column if not exists output_manifest jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'seo_generation_runs_output_manifest_array'
      and conrelid = 'public.seo_generation_runs'::regclass
  ) then
    alter table public.seo_generation_runs
      add constraint seo_generation_runs_output_manifest_array
      check (jsonb_typeof(output_manifest) = 'array');
  end if;
end;
$$;

create index if not exists seo_generation_runs_provider_model_idx
  on public.seo_generation_runs (provider, model, created_at desc);

-- Migration 006 intentionally inserts the evidence packet in source_asset.
-- This trigger keeps that function backwards-compatible while projecting the
-- new queryable fields from the validated packet.
create or replace function public.set_seo_generation_metadata()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
declare
  packet jsonb := coalesce(new.source_asset, '{}'::jsonb);
  outputs jsonb := coalesce(packet->'outputManifest', packet->'outputs', '[]'::jsonb);
begin
  new.provider := coalesce(nullif(trim(new.provider), ''), nullif(trim(packet->>'provider'), ''));
  new.model := coalesce(nullif(trim(new.model), ''), nullif(trim(packet->>'model'), ''));
  if jsonb_typeof(outputs) = 'array' then
    new.output_manifest := outputs;
  end if;
  return new;
end;
$$;

drop trigger if exists seo_generation_runs_metadata on public.seo_generation_runs;
create trigger seo_generation_runs_metadata
before insert or update of source_asset, provider, model, output_manifest
on public.seo_generation_runs
for each row execute function public.set_seo_generation_metadata();

comment on column public.seo_generation_runs.provider is
  'Generation provider recorded by the evidence packet (for example Airveek).';
comment on column public.seo_generation_runs.model is
  'Exact image model/version recorded by the evidence packet.';
comment on column public.seo_generation_runs.output_manifest is
  'Checksummed output references from the generation run.';

commit;
