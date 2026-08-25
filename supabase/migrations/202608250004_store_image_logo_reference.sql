alter table public.store_bulk_runs
  add column if not exists reference_asset_id uuid references public.creator_assets(id) on delete set null;

create index if not exists store_bulk_runs_reference_asset
  on public.store_bulk_runs (reference_asset_id)
  where reference_asset_id is not null;
