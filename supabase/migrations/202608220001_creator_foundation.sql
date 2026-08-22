create extension if not exists supabase_vault with schema vault;

create table if not exists public.image_provider_settings (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  kind text not null check (kind in ('gemini-official', 'gemini-compatible')),
  base_url text not null,
  model text not null,
  api_key_secret_id uuid,
  is_active boolean not null default false,
  supports_text_to_image boolean not null default false,
  supports_reference_images boolean not null default false,
  tested_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists one_active_image_provider
  on public.image_provider_settings (is_active)
  where is_active = true;

create table if not exists public.creator_storage_settings (
  id boolean primary key default true check (id),
  drive_refresh_token_secret_id uuid,
  drive_folder_id text,
  drive_account_email text,
  drive_connected_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.creator_storage_settings (id)
values (true)
on conflict (id) do nothing;

create table if not exists public.creator_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('product', 'person', 'character', 'reference', 'generation')),
  name text not null check (char_length(name) between 1 and 160),
  arena_id text check (arena_id is null or arena_id in ('general-image', 'product-fashion', 'storybook-page')),
  prompt text,
  settings jsonb not null default '{}'::jsonb,
  source_asset_ids uuid[] not null default '{}'::uuid[],
  status text not null default 'processing' check (status in ('processing', 'ready', 'failed')),
  mime_type text check (mime_type is null or mime_type in ('image/png', 'image/jpeg', 'image/webp')),
  drive_file_id text,
  r2_key text,
  r2_expires_at timestamptz,
  provider_kind text check (provider_kind is null or provider_kind in ('gemini-official', 'gemini-compatible')),
  provider_model text,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists creator_assets_user_created
  on public.creator_assets (user_id, created_at desc);

create index if not exists creator_assets_user_kind
  on public.creator_assets (user_id, kind, created_at desc);

create unique index if not exists one_processing_generation_per_user
  on public.creator_assets (user_id)
  where kind = 'generation' and status = 'processing';

alter table public.creator_assets enable row level security;
alter table public.image_provider_settings enable row level security;
alter table public.creator_storage_settings enable row level security;

drop policy if exists "Users can read their own creator assets" on public.creator_assets;
create policy "Users can read their own creator assets"
  on public.creator_assets
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.image_provider_settings from anon, authenticated;
revoke all on public.creator_storage_settings from anon, authenticated;
revoke insert, update, delete on public.creator_assets from anon, authenticated;
grant select on public.creator_assets to authenticated;

create or replace function public.set_airveek_secret(secret_name text, secret_value text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_id uuid;
begin
  if secret_name !~ '^airveek_[a-z0-9_]+$' then
    raise exception 'Invalid Airveek secret name';
  end if;

  if secret_value is null or char_length(secret_value) = 0 then
    raise exception 'Secret value cannot be empty';
  end if;

  select id
  into existing_id
  from vault.decrypted_secrets
  where name = secret_name
  limit 1;

  if existing_id is null then
    return vault.create_secret(secret_value, secret_name, 'Airveek server integration secret');
  end if;

  perform vault.update_secret(existing_id, secret_value, secret_name, 'Airveek server integration secret');
  return existing_id;
end;
$$;

create or replace function public.read_airveek_secret(secret_id uuid)
returns text
language sql
security definer
set search_path = ''
stable
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where id = secret_id
  limit 1;
$$;

create or replace function public.delete_airveek_secret(secret_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from vault.secrets where id = secret_id;
$$;

revoke all on function public.set_airveek_secret(text, text) from public, anon, authenticated;
revoke all on function public.read_airveek_secret(uuid) from public, anon, authenticated;
revoke all on function public.delete_airveek_secret(uuid) from public, anon, authenticated;
grant execute on function public.set_airveek_secret(text, text) to service_role;
grant execute on function public.read_airveek_secret(uuid) to service_role;
grant execute on function public.delete_airveek_secret(uuid) to service_role;

