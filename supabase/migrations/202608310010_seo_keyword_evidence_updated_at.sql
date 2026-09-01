begin;

drop trigger if exists seo_keyword_evidence_updated_at on public.seo_keyword_evidence;
create trigger seo_keyword_evidence_updated_at
  before update on public.seo_keyword_evidence
  for each row execute function public.set_seo_updated_at();

commit;
