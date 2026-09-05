create table if not exists public.user_legal_acceptances (
  user_id uuid not null references auth.users(id) on delete cascade,
  terms_version text not null,
  privacy_version text not null,
  accepted_at timestamptz not null default now(),
  source text not null,
  primary key (user_id, terms_version, privacy_version)
);

alter table public.user_legal_acceptances enable row level security;

revoke all on table public.user_legal_acceptances from anon, authenticated;
grant all on table public.user_legal_acceptances to service_role;

create or replace function public.capture_user_legal_acceptance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  if metadata ->> 'legal_acceptance' = 'accepted'
    and nullif(metadata ->> 'terms_version', '') is not null
    and nullif(metadata ->> 'privacy_version', '') is not null then
    insert into public.user_legal_acceptances (
      user_id,
      terms_version,
      privacy_version,
      accepted_at,
      source
    ) values (
      new.id,
      metadata ->> 'terms_version',
      metadata ->> 'privacy_version',
      now(),
      left(coalesce(nullif(metadata ->> 'legal_acceptance_source', ''), 'signup'), 80)
    )
    on conflict do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public.capture_user_legal_acceptance() from public, anon, authenticated;

drop trigger if exists capture_user_legal_acceptance_on_signup on auth.users;
create trigger capture_user_legal_acceptance_on_signup
after insert on auth.users
for each row execute function public.capture_user_legal_acceptance();

comment on table public.user_legal_acceptances is
  'Immutable audit record of the Terms and Privacy versions accepted during account creation.';
