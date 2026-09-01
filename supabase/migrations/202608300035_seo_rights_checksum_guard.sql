begin;

-- An approved rights evidence item must identify the exact source asset it
-- covers. Without this binding, a worker could reuse a valid evidence ID for
-- a different file or product variant and still pass the rights gate.
create or replace function public.validate_seo_rights_item_checksum()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  checksum text;
begin
  if new.item_type = 'rights' and new.rights_status = 'approved' then
    checksum := new.metadata->>'sourceAssetChecksum';
    if checksum is null or checksum !~* '^sha256:[a-f0-9]{64}$' then
      raise exception 'Approved SEO rights evidence items require metadata.sourceAssetChecksum as sha256:<64 hex characters>.';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.validate_seo_rights_item_checksum() from public, anon, authenticated;

drop trigger if exists seo_evidence_items_rights_checksum on public.seo_evidence_items;
create trigger seo_evidence_items_rights_checksum
before insert or update on public.seo_evidence_items
for each row execute function public.validate_seo_rights_item_checksum();

comment on function public.validate_seo_rights_item_checksum() is
  'Requires approved rights evidence to bind to an exact source-asset SHA-256 checksum.';

commit;
