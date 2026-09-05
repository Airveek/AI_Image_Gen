-- Automatic publishing may continue numbering waves while the configured
-- daily page limit has capacity. The old 1..4 constraint was an operating
-- preference from the pilot rollout, not a safety boundary, and strands
-- approved pages after the fourth wave.
alter table public.seo_publish_batches
  drop constraint if exists seo_publish_batches_wave_check;
alter table public.seo_publish_batches
  add constraint seo_publish_batches_wave_check
  check (wave between 1 and 32767);
comment on constraint seo_publish_batches_wave_check on public.seo_publish_batches is
  'Wave numbering is operational metadata; the daily publish limit controls throughput.';
