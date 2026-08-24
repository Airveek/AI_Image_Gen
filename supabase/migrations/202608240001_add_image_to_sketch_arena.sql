-- Allow the Image to Sketch creator arena to be stored alongside the
-- existing creator arenas. This is safe to run after the creator foundation
-- migration and does not change any existing rows or columns.
begin;

alter table public.creator_assets
  drop constraint if exists creator_assets_arena_id_check;

alter table public.creator_assets
  add constraint creator_assets_arena_id_check
  check (
    arena_id is null
    or arena_id in ('general-image', 'product-fashion', 'storybook-page', 'image-to-sketch')
  );

commit;
