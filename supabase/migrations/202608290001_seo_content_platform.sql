begin;

create extension if not exists vector with schema extensions;

create table if not exists public.content_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 100),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  role text not null check (role in ('writer', 'brief_lead', 'editor', 'publisher', 'seo_admin')),
  pod_id text check (pod_id is null or char_length(pod_id) between 1 and 40),
  bio text check (bio is null or char_length(bio) <= 1000),
  expertise text[] not null default '{}',
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.seo_topics (
  id uuid primary key default gen_random_uuid(),
  locale text not null default 'en' check (locale ~ '^[a-z]{2}(?:-[A-Z]{2})?$'),
  kind text not null check (kind in ('product', 'category', 'feature', 'tutorial')),
  name text not null check (char_length(name) between 2 and 160),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  parent_id uuid references public.seo_topics(id) on delete set null,
  taxonomy_id text,
  buyer_questions jsonb not null default '[]'::jsonb check (jsonb_typeof(buyer_questions) = 'array'),
  opportunity_score smallint check (opportunity_score is null or opportunity_score between 0 and 100),
  demand_evidence jsonb not null default '[]'::jsonb check (jsonb_typeof(demand_evidence) = 'array'),
  rights_status text not null default 'unreviewed' check (rights_status in ('unreviewed', 'approved', 'restricted', 'rejected')),
  status text not null default 'candidate' check (status in ('candidate', 'approved', 'paused', 'retired')),
  created_by uuid references public.content_members(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (locale, kind, slug)
);

create table if not exists public.seo_generation_runs (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.seo_topics(id) on delete restrict,
  opportunity_id text,
  image_job text not null check (image_job in ('listing', 'lifestyle', 'detail', 'prompt', 'tutorial')),
  creator_asset_id uuid references public.creator_assets(id) on delete set null,
  creator_route text not null check (creator_route like '/create/%'),
  arena_id text not null,
  source_asset jsonb not null check (jsonb_typeof(source_asset) = 'object'),
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  prompt text not null check (char_length(prompt) between 10 and 12000),
  negative_constraints text[] not null default '{}',
  kit_path text,
  kit_checksum text not null unique check (kit_checksum ~ '^[a-f0-9]{64}$'),
  qa_status text not null default 'pending' check (qa_status in ('pending', 'pass', 'fail', 'superseded')),
  qa_summary jsonb not null default '{}'::jsonb check (jsonb_typeof(qa_summary) = 'object'),
  recorded_at timestamptz,
  created_by uuid references public.content_members(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.seo_pages (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid references public.seo_topics(id) on delete restrict,
  locale text not null default 'en' check (locale ~ '^[a-z]{2}(?:-[A-Z]{2})?$'),
  page_family text not null check (page_family in ('product-hub', 'category-hub', 'listing', 'lifestyle', 'detail', 'prompt', 'tutorial', 'feature')),
  status text not null default 'idea' check (status in ('idea', 'assigned', 'draft', 'automated_qa', 'qa_failed', 'editor_review', 'changes_requested', 'approved', 'scheduled', 'publishing', 'live', 'refresh', 'merged', 'archived')),
  path text not null unique check (path ~ '^/[a-z0-9][a-z0-9/-]*/?$'),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  product_slug text check (product_slug is null or product_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  job_slug text check (job_slug is null or job_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 10 and 180),
  meta_title text not null check (char_length(meta_title) between 10 and 180),
  meta_description text not null check (char_length(meta_description) between 40 and 320),
  direct_answer text not null check (char_length(direct_answer) between 40 and 1000),
  primary_query text not null check (char_length(primary_query) between 2 and 240),
  primary_intent text not null check (char_length(primary_intent) between 10 and 500),
  normalized_intent_key text not null check (normalized_intent_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  body jsonb not null default '{}'::jsonb check (jsonb_typeof(body) = 'object'),
  content_embedding extensions.vector(1536),
  author_id uuid references public.content_members(user_id) on delete restrict,
  reviewer_id uuid references public.content_members(user_id) on delete restrict,
  template_version text not null default 'seo-v1' check (char_length(template_version) between 1 and 40),
  cohort_id text check (cohort_id is null or char_length(cohort_id) between 1 and 80),
  quality_score smallint check (quality_score is null or quality_score between 0 and 100),
  canonical_page_id uuid references public.seo_pages(id) on delete restrict,
  noindex boolean not null default true,
  scheduled_for timestamptz,
  published_at timestamptz,
  search_lastmod_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (canonical_page_id is null or canonical_page_id <> id),
  check (status <> 'live' or (noindex = false and author_id is not null and reviewer_id is not null and published_at is not null and quality_score >= 85))
);

create unique index if not exists seo_pages_active_intent_unique
  on public.seo_pages (locale, normalized_intent_key)
  where status not in ('merged', 'archived');

create index if not exists seo_pages_public_family_published
  on public.seo_pages (page_family, published_at desc)
  where status = 'live' and noindex = false;

create index if not exists seo_pages_product_job
  on public.seo_pages (product_slug, job_slug)
  where status = 'live' and noindex = false;

create index if not exists seo_pages_embedding_hnsw
  on public.seo_pages using hnsw (content_embedding extensions.vector_cosine_ops)
  where content_embedding is not null;

create table if not exists public.seo_page_generation_runs (
  page_id uuid not null references public.seo_pages(id) on delete cascade,
  generation_run_id uuid not null references public.seo_generation_runs(id) on delete restrict,
  evidence_role text not null check (evidence_role in ('primary', 'supporting', 'aggregate')),
  created_at timestamptz not null default now(),
  primary key (page_id, generation_run_id)
);

create table if not exists public.seo_assets (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.seo_pages(id) on delete cascade,
  generation_run_id uuid references public.seo_generation_runs(id) on delete set null,
  role text not null check (role in ('source', 'hero', 'selected', 'rejected', 'corrected', 'screenshot', 'video', 'og')),
  public_url text not null check (public_url ~ '^https://'),
  storage_key text not null unique,
  checksum text not null check (checksum ~ '^[a-f0-9]{64}$'),
  mime_type text not null check (mime_type in ('image/png', 'image/jpeg', 'image/webp', 'video/mp4', 'video/webm')),
  width integer check (width is null or width between 1 and 16384),
  height integer check (height is null or height between 1 and 16384),
  alt_text text check (alt_text is null or char_length(alt_text) <= 500),
  caption text check (caption is null or char_length(caption) <= 1000),
  provenance text not null check (char_length(provenance) between 3 and 1000),
  rights_status text not null check (rights_status in ('approved', 'restricted', 'rejected')),
  qa_status text not null default 'pending' check (qa_status in ('pending', 'pass', 'fail')),
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists seo_assets_page_order on public.seo_assets (page_id, sort_order, created_at);

create table if not exists public.seo_sources (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.seo_pages(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 300),
  url text not null check (url ~ '^https://'),
  publisher text,
  claim_ids text[] not null default '{}',
  accessed_at timestamptz not null,
  review_after timestamptz,
  created_at timestamptz not null default now(),
  unique (page_id, url)
);

create table if not exists public.seo_links (
  id uuid primary key default gen_random_uuid(),
  source_page_id uuid not null references public.seo_pages(id) on delete cascade,
  target_page_id uuid not null references public.seo_pages(id) on delete cascade,
  link_type text not null check (link_type in ('parent', 'sibling', 'related', 'tutorial', 'feature', 'prompt', 'breadcrumb')),
  anchor_text text not null check (char_length(anchor_text) between 2 and 240),
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (source_page_id <> target_page_id),
  unique (source_page_id, target_page_id, link_type)
);

create index if not exists seo_links_target on public.seo_links (target_page_id, source_page_id);

create table if not exists public.seo_redirects (
  id uuid primary key default gen_random_uuid(),
  source_path text not null unique check (source_path ~ '^/[a-z0-9][a-z0-9/-]*/?$'),
  destination_page_id uuid not null references public.seo_pages(id) on delete restrict,
  status_code smallint not null default 301 check (status_code in (301, 308)),
  reason text not null check (char_length(reason) between 3 and 500),
  created_by uuid not null references public.content_members(user_id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.seo_quality_runs (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.seo_pages(id) on delete cascade,
  gate_version text not null check (char_length(gate_version) between 1 and 40),
  status text not null check (status in ('pass', 'fail')),
  score smallint not null check (score between 0 and 100),
  checks jsonb not null check (jsonb_typeof(checks) = 'object'),
  blockers text[] not null default '{}',
  rendered_status integer,
  rendered_canonical text,
  created_at timestamptz not null default now()
);

create index if not exists seo_quality_runs_page_created on public.seo_quality_runs (page_id, created_at desc);

create table if not exists public.seo_publish_batches (
  id uuid primary key default gen_random_uuid(),
  cohort_id text not null check (char_length(cohort_id) between 1 and 80),
  wave smallint not null check (wave between 1 and 4),
  status text not null default 'scheduled' check (status in ('scheduled', 'running', 'complete', 'partial', 'failed', 'cancelled')),
  scheduled_for timestamptz not null,
  started_at timestamptz,
  finished_at timestamptz,
  sitemap_status text not null default 'pending' check (sitemap_status in ('pending', 'ready', 'failed')),
  indexnow_status text not null default 'pending' check (indexnow_status in ('pending', 'submitted', 'failed', 'skipped')),
  created_by uuid not null references public.content_members(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (cohort_id, wave)
);

create table if not exists public.seo_publish_batch_pages (
  batch_id uuid not null references public.seo_publish_batches(id) on delete cascade,
  page_id uuid not null references public.seo_pages(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'warming', 'live', 'failed', 'replaced')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (batch_id, page_id)
);

create table if not exists public.seo_template_rollouts (
  template_version text primary key check (char_length(template_version) between 1 and 40),
  status text not null default 'manual_review' check (status in ('manual_review', 'proven', 'paused')),
  reviewed_page_count integer not null default 0 check (reviewed_page_count >= 0),
  healthy_since timestamptz,
  last_incident_at timestamptz,
  notes text,
  updated_at timestamptz not null default now(),
  check (status <> 'proven' or (reviewed_page_count >= 50 and healthy_since is not null))
);

insert into public.seo_template_rollouts (template_version)
values ('seo-v1')
on conflict (template_version) do nothing;

create or replace function public.set_seo_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'content_members', 'seo_topics', 'seo_generation_runs', 'seo_pages',
    'seo_assets', 'seo_links', 'seo_publish_batch_pages', 'seo_template_rollouts'
  ]
  loop
    execute format('drop trigger if exists %I on public.%I', table_name || '_updated_at', table_name);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_seo_updated_at()',
      table_name || '_updated_at',
      table_name
    );
  end loop;
end;
$$;

create or replace function public.is_active_content_member()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.content_members
    where user_id = (select auth.uid()) and is_active = true
  );
$$;

create or replace function public.content_member_role()
returns text
language sql
security definer
set search_path = ''
stable
as $$
  select role from public.content_members
  where user_id = (select auth.uid()) and is_active = true
  limit 1;
$$;

create or replace function public.can_brief_seo_content()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(public.content_member_role() in ('brief_lead', 'editor', 'publisher', 'seo_admin'), false);
$$;

create or replace function public.can_edit_all_seo_content()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(public.content_member_role() in ('editor', 'publisher', 'seo_admin'), false);
$$;

create or replace function public.can_publish_seo_content()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(public.content_member_role() in ('publisher', 'seo_admin'), false);
$$;

create or replace function public.can_edit_seo_page(target_page_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.seo_pages
    where id = target_page_id
      and (
        public.can_edit_all_seo_content()
        or (
          author_id = (select auth.uid())
          and status in ('idea', 'assigned', 'draft', 'qa_failed', 'changes_requested')
        )
      )
  );
$$;

revoke all on function public.set_seo_updated_at() from public, anon, authenticated;
revoke all on function public.is_active_content_member() from public, anon;
revoke all on function public.content_member_role() from public, anon;
revoke all on function public.can_brief_seo_content() from public, anon;
revoke all on function public.can_edit_all_seo_content() from public, anon;
revoke all on function public.can_publish_seo_content() from public, anon;
revoke all on function public.can_edit_seo_page(uuid) from public, anon;
grant execute on function public.is_active_content_member() to authenticated, service_role;
grant execute on function public.content_member_role() to authenticated, service_role;
grant execute on function public.can_brief_seo_content() to authenticated, service_role;
grant execute on function public.can_edit_all_seo_content() to authenticated, service_role;
grant execute on function public.can_publish_seo_content() to authenticated, service_role;
grant execute on function public.can_edit_seo_page(uuid) to authenticated, service_role;

alter table public.content_members enable row level security;
alter table public.seo_topics enable row level security;
alter table public.seo_generation_runs enable row level security;
alter table public.seo_pages enable row level security;
alter table public.seo_page_generation_runs enable row level security;
alter table public.seo_assets enable row level security;
alter table public.seo_sources enable row level security;
alter table public.seo_links enable row level security;
alter table public.seo_redirects enable row level security;
alter table public.seo_quality_runs enable row level security;
alter table public.seo_publish_batches enable row level security;
alter table public.seo_publish_batch_pages enable row level security;
alter table public.seo_template_rollouts enable row level security;

create policy "Members can read their content membership"
  on public.content_members for select to authenticated
  using (user_id = (select auth.uid()) or public.can_edit_all_seo_content());

create policy "SEO admins can manage content memberships"
  on public.content_members for all to authenticated
  using (public.content_member_role() = 'seo_admin')
  with check (public.content_member_role() = 'seo_admin');

create policy "Content members can read SEO topics"
  on public.seo_topics for select to authenticated
  using (public.is_active_content_member());

create policy "Brief leads can create SEO topics"
  on public.seo_topics for insert to authenticated
  with check (public.can_brief_seo_content());

create policy "Brief leads can update SEO topics"
  on public.seo_topics for update to authenticated
  using (public.can_brief_seo_content())
  with check (public.can_brief_seo_content());

create policy "SEO admins can delete SEO topics"
  on public.seo_topics for delete to authenticated
  using (public.content_member_role() = 'seo_admin');

create policy "Content members can read generation evidence"
  on public.seo_generation_runs for select to authenticated
  using (public.is_active_content_member());

create policy "Brief leads can create generation evidence"
  on public.seo_generation_runs for insert to authenticated
  with check (public.can_brief_seo_content());

create policy "Brief leads can update generation evidence"
  on public.seo_generation_runs for update to authenticated
  using (public.can_brief_seo_content())
  with check (public.can_brief_seo_content());

create policy "SEO admins can delete generation evidence"
  on public.seo_generation_runs for delete to authenticated
  using (public.content_member_role() = 'seo_admin');

create policy "Content members can read SEO pages"
  on public.seo_pages for select to authenticated
  using (public.is_active_content_member());

create policy "Authors can create assigned SEO pages"
  on public.seo_pages for insert to authenticated
  with check (
    public.is_active_content_member()
    and (author_id = (select auth.uid()) or public.can_edit_all_seo_content())
    and status in ('idea', 'assigned', 'draft')
  );

create policy "Authors can update their draft SEO pages"
  on public.seo_pages for update to authenticated
  using (public.can_edit_seo_page(id))
  with check (
    (author_id = (select auth.uid()) and status in ('idea', 'assigned', 'draft', 'automated_qa', 'qa_failed', 'editor_review', 'changes_requested'))
    or (public.can_edit_all_seo_content() and status not in ('publishing', 'live', 'merged', 'archived'))
    or public.can_publish_seo_content()
  );

create policy "SEO admins can delete non-live SEO pages"
  on public.seo_pages for delete to authenticated
  using (public.content_member_role() = 'seo_admin' and status <> 'live');

create policy "Content members can read page evidence links"
  on public.seo_page_generation_runs for select to authenticated
  using (public.is_active_content_member());

create policy "Page editors can manage page evidence links"
  on public.seo_page_generation_runs for all to authenticated
  using (public.can_edit_seo_page(page_id))
  with check (public.can_edit_seo_page(page_id));

create policy "Content members can read SEO assets"
  on public.seo_assets for select to authenticated
  using (public.is_active_content_member());

create policy "Page editors can manage SEO assets"
  on public.seo_assets for all to authenticated
  using (public.can_edit_seo_page(page_id))
  with check (public.can_edit_seo_page(page_id));

create policy "Content members can read SEO sources"
  on public.seo_sources for select to authenticated
  using (public.is_active_content_member());

create policy "Page editors can manage SEO sources"
  on public.seo_sources for all to authenticated
  using (public.can_edit_seo_page(page_id))
  with check (public.can_edit_seo_page(page_id));

create policy "Content members can read internal links"
  on public.seo_links for select to authenticated
  using (public.is_active_content_member());

create policy "Editors can manage internal links"
  on public.seo_links for all to authenticated
  using (public.can_edit_all_seo_content())
  with check (public.can_edit_all_seo_content());

create policy "Content members can read redirects"
  on public.seo_redirects for select to authenticated
  using (public.is_active_content_member());

create policy "Publishers can manage redirects"
  on public.seo_redirects for all to authenticated
  using (public.can_publish_seo_content())
  with check (public.can_publish_seo_content());

create policy "Content members can read quality runs"
  on public.seo_quality_runs for select to authenticated
  using (public.is_active_content_member());

create policy "Content members can read publish batches"
  on public.seo_publish_batches for select to authenticated
  using (public.is_active_content_member());

create policy "Publishers can manage publish batches"
  on public.seo_publish_batches for all to authenticated
  using (public.can_publish_seo_content())
  with check (public.can_publish_seo_content());

create policy "Content members can read publish batch pages"
  on public.seo_publish_batch_pages for select to authenticated
  using (public.is_active_content_member());

create policy "Publishers can manage publish batch pages"
  on public.seo_publish_batch_pages for all to authenticated
  using (public.can_publish_seo_content())
  with check (public.can_publish_seo_content());

create policy "Content members can read template rollouts"
  on public.seo_template_rollouts for select to authenticated
  using (public.is_active_content_member());

create policy "SEO admins can manage template rollouts"
  on public.seo_template_rollouts for all to authenticated
  using (public.content_member_role() = 'seo_admin')
  with check (public.content_member_role() = 'seo_admin');

revoke all on public.content_members, public.seo_topics, public.seo_generation_runs, public.seo_pages,
  public.seo_page_generation_runs, public.seo_assets, public.seo_sources, public.seo_links,
  public.seo_redirects, public.seo_quality_runs, public.seo_publish_batches,
  public.seo_publish_batch_pages, public.seo_template_rollouts from anon;

grant select, insert, update, delete on public.content_members, public.seo_topics,
  public.seo_generation_runs, public.seo_pages, public.seo_page_generation_runs,
  public.seo_assets, public.seo_sources, public.seo_links, public.seo_redirects,
  public.seo_publish_batches, public.seo_publish_batch_pages, public.seo_template_rollouts to authenticated;
grant select on public.seo_quality_runs to authenticated;

grant all on public.content_members, public.seo_topics, public.seo_generation_runs,
  public.seo_pages, public.seo_page_generation_runs, public.seo_assets, public.seo_sources,
  public.seo_links, public.seo_redirects, public.seo_quality_runs,
  public.seo_publish_batches, public.seo_publish_batch_pages, public.seo_template_rollouts to service_role;

comment on table public.seo_pages is 'Structured, review-gated SEO pages. Public routes read only live, indexable rows through the server-side service role.';
comment on table public.seo_generation_runs is 'Immutable evidence imported from one complete Airveek generation/content-kit attempt.';
comment on table public.seo_quality_runs is 'Append-only automated publish-gate results; only the service role writes this table.';

commit;
