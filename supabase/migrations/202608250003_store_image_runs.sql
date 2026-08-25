create table if not exists public.store_bulk_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prompt text not null check (char_length(prompt) between 1 and 600),
  image_mode text not null check (image_mode in ('replace-primary', 'keep-both', 'replace-all')),
  selection_mode text not null check (selection_mode in ('selected', 'all')),
  selected_product_ids text[] not null default '{}',
  search text not null default '',
  status_filter text not null default 'active' check (status_filter in ('active', 'draft', 'archived')),
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'completed-with-errors', 'failed')),
  total_count integer not null default 0,
  completed_count integer not null default 0,
  failed_count integer not null default 0,
  published_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_bulk_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.store_bulk_runs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null,
  product_name text not null,
  source_image_url text,
  source_image_version timestamptz,
  generated_asset_id uuid references public.creator_assets(id) on delete set null,
  status text not null default 'queued' check (status in ('queued', 'generating', 'ready', 'publishing', 'published', 'failed')),
  error_message text,
  published_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, product_id)
);

create index if not exists store_bulk_runs_user_created
  on public.store_bulk_runs (user_id, created_at desc);

create index if not exists store_bulk_items_run_status
  on public.store_bulk_items (run_id, status, created_at desc);

alter table public.store_bulk_runs enable row level security;
alter table public.store_bulk_items enable row level security;

create policy "Users can read their store image runs"
  on public.store_bulk_runs for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can read their store image items"
  on public.store_bulk_items for select to authenticated
  using ((select auth.uid()) = user_id);

revoke insert, update, delete on public.store_bulk_runs from anon, authenticated;
revoke insert, update, delete on public.store_bulk_items from anon, authenticated;
