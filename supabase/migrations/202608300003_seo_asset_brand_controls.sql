begin;

-- Brand and provenance controls are kept on the durable asset record so a
-- renderer or reviewer never has to infer whether a logo may be added.
alter table public.seo_assets
  add column if not exists logo_policy text not null default 'unverified_brand';

alter table public.seo_assets
  add column if not exists ai_provenance text;

alter table public.seo_assets
  add column if not exists generation_metadata jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'seo_assets_logo_policy_check'
      and conrelid = 'public.seo_assets'::regclass
  ) then
    alter table public.seo_assets
      add constraint seo_assets_logo_policy_check
      check (logo_policy in (
        'inherent_product_branding',
        'authorized_overlay_branding',
        'marketplace_restricted',
        'unverified_brand'
      ));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'seo_assets_generation_metadata_object_check'
      and conrelid = 'public.seo_assets'::regclass
  ) then
    alter table public.seo_assets
      add constraint seo_assets_generation_metadata_object_check
      check (jsonb_typeof(generation_metadata) = 'object');
  end if;
end $$;

comment on column public.seo_assets.logo_policy is
  'Explicit logo/brand handling policy; never infer permission from generated pixels.';
comment on column public.seo_assets.ai_provenance is
  'How the asset was produced, including model/provider or user-supplied provenance.';
comment on column public.seo_assets.generation_metadata is
  'Structured prompt/settings/checksum metadata used by the evidence-led QA loop.';

commit;
