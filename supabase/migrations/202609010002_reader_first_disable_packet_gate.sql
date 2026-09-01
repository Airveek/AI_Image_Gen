begin;

-- Reader-first mode does not use evidence packets as a publishing gate. Keep
-- the packet/item tables and historical rows for audit, but stop blocking
-- packet writes on rights/evidence approval completeness. The page validator,
-- ingest RPC, and publish gate still enforce the technical/content checks that
-- make a useful page safe to render.
drop trigger if exists seo_evidence_packets_validate on public.seo_evidence_packets;

comment on table public.seo_evidence_packets is
  'Historical evidence packets retained for audit; reader-first publishing does not require packet approval.';

commit;
