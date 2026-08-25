alter table public.store_bulk_runs
  drop constraint if exists store_bulk_runs_status_check;

alter table public.store_bulk_runs
  add constraint store_bulk_runs_status_check
  check (status in ('queued', 'running', 'completed', 'completed-with-errors', 'failed', 'cancelled'));

alter table public.store_bulk_items
  drop constraint if exists store_bulk_items_status_check;

alter table public.store_bulk_items
  add constraint store_bulk_items_status_check
  check (status in ('queued', 'generating', 'ready', 'publishing', 'published', 'failed', 'cancelled'));
