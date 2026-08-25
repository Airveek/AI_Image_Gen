-- Allow the three Product & Fashion pack shots to be processed at the same time.
-- The existing UI still prevents duplicate pack submissions and the server-side
-- daily generation limit remains unchanged.

drop index if exists public.one_processing_generation_per_user;

create index if not exists creator_assets_processing_by_user
  on public.creator_assets (user_id, created_at desc)
  where kind = 'generation' and status = 'processing';
