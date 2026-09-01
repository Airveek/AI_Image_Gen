begin;

-- This migration adds the operating layer around the existing SEO page and
-- generation tables. It is intentionally additive: drafts, evidence packets,
-- assignments, and decisions are retained as history and are never hard-
-- deleted. The service-role publish gate remains the only indexability path.

create table if not exists public.seo_content_briefs (
  id uuid primary key default gen_random_uuid(),
  brief_key text not null unique check (char_length(brief_key) between 8 and 200),
  topic_id uuid not null references public.seo_topics(id) on delete restrict,
  page_id uuid references public.seo_pages(id) on delete set null,
  locale text not null default 'en' check (locale ~ '^[a-z]{2}(?:-[A-Z]{2})?$'),
  page_family text not null check (page_family in ('product-hub', 'category-hub', 'listing', 'lifestyle', 'detail', 'prompt', 'tutorial', 'feature')),
  product_entity text not null check (char_length(product_entity) between 2 and 180),
  job_slug text check (job_slug is null or job_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  primary_query text not null check (char_length(primary_query) between 2 and 240),
  normalized_intent_key text not null check (normalized_intent_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  buyer_question text not null check (char_length(buyer_question) between 10 and 500),
  brief jsonb not null default '{}'::jsonb check (jsonb_typeof(brief) = 'object'),
  demand_evidence jsonb not null default '[]'::jsonb check (jsonb_typeof(demand_evidence) = 'array'),
  opportunity_score smallint check (opportunity_score is null or opportunity_score between 0 and 100),
  priority smallint not null default 50 check (priority between 0 and 100),
  template_version text not null default 'seo-v1' check (char_length(template_version) between 1 and 40),
  status text not null default 'idea' check (status in (
    'idea', 'researching', 'ready_for_assignment', 'assigned', 'in_progress',
    'submitted', 'editor_review', 'changes_requested', 'approved', 'scheduled',
    'blocked', 'merged', 'archived'
  )),
  created_by uuid references public.content_members(user_id) on delete set null,
  brief_lead_id uuid references public.content_members(user_id) on delete set null,
  due_at timestamptz,
  submitted_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists seo_content_briefs_active_intent_idx
  on public.seo_content_briefs (locale, normalized_intent_key)
  where status not in ('merged', 'archived');
create index if not exists seo_content_briefs_queue_idx
  on public.seo_content_briefs (status, priority desc, due_at nulls last, created_at);
create index if not exists seo_content_briefs_topic_idx
  on public.seo_content_briefs (topic_id, created_at desc);
create index if not exists seo_content_briefs_assignee_lead_idx
  on public.seo_content_briefs (brief_lead_id, status, due_at)
  where brief_lead_id is not null;

create table if not exists public.seo_evidence_packets (
  id uuid primary key default gen_random_uuid(),
  brief_id uuid not null references public.seo_content_briefs(id) on delete restrict,
  page_id uuid references public.seo_pages(id) on delete set null,
  packet_type text not null check (packet_type in ('research', 'rights', 'workflow', 'editorial', 'quality')),
  version integer not null default 1 check (version > 0),
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'rejected', 'expired')),
  rights_status text not null default 'unreviewed' check (rights_status in ('unreviewed', 'approved', 'restricted', 'rejected')),
  packet_checksum text check (packet_checksum is null or packet_checksum ~ '^[a-f0-9]{64}$'),
  summary text check (summary is null or char_length(summary) <= 2000),
  packet jsonb not null default '{}'::jsonb check (jsonb_typeof(packet) = 'object'),
  collected_by uuid references public.content_members(user_id) on delete set null,
  reviewed_by uuid references public.content_members(user_id) on delete set null,
  reviewed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brief_id, packet_type, version),
  check (status not in ('submitted', 'approved') or packet_checksum is not null),
  check (status <> 'approved' or (reviewed_by is not null and reviewed_at is not null)),
  check (rights_status <> 'approved' or (reviewed_by is not null and reviewed_at is not null))
);

create index if not exists seo_evidence_packets_brief_type_idx
  on public.seo_evidence_packets (brief_id, packet_type, version desc);
create index if not exists seo_evidence_packets_review_queue_idx
  on public.seo_evidence_packets (status, packet_type, created_at)
  where status in ('submitted', 'approved');
create index if not exists seo_evidence_packets_expiry_idx
  on public.seo_evidence_packets (expires_at)
  where expires_at is not null;

create table if not exists public.seo_evidence_items (
  id uuid primary key default gen_random_uuid(),
  packet_id uuid not null references public.seo_evidence_packets(id) on delete restrict,
  item_key text not null check (char_length(item_key) between 2 and 200),
  item_type text not null check (item_type in ('query', 'serp', 'reddit', 'youtube', 'social', 'first_party', 'rights', 'claim', 'competitor', 'other')),
  source_url text check (source_url is null or source_url ~ '^https://'),
  source_title text check (source_title is null or char_length(source_title) <= 500),
  publisher text check (publisher is null or char_length(publisher) <= 300),
  query text check (query is null or char_length(query) <= 500),
  claim_key text check (claim_key is null or claim_key ~ '^[a-z0-9][a-z0-9_-]*$'),
  claim_text text check (claim_text is null or char_length(claim_text) <= 4000),
  excerpt text check (excerpt is null or char_length(excerpt) <= 4000),
  rights_status text not null default 'unreviewed' check (rights_status in ('unreviewed', 'approved', 'restricted', 'rejected')),
  rights_evidence_id text check (rights_evidence_id is null or char_length(rights_evidence_id) between 3 and 200),
  accessed_at timestamptz,
  review_after timestamptz,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  collected_by uuid references public.content_members(user_id) on delete set null,
  created_at timestamptz not null default now(),
  unique (packet_id, item_key),
  check (rights_status <> 'approved' or rights_evidence_id is not null),
  check (source_url is null or accessed_at is not null)
);

create index if not exists seo_evidence_items_packet_type_idx
  on public.seo_evidence_items (packet_id, item_type, created_at);
create index if not exists seo_evidence_items_claim_idx
  on public.seo_evidence_items (claim_key, packet_id)
  where claim_key is not null;
create index if not exists seo_evidence_items_rights_idx
  on public.seo_evidence_items (rights_status, item_type)
  where item_type = 'rights';

create table if not exists public.seo_content_assignments (
  id uuid primary key default gen_random_uuid(),
  brief_id uuid not null references public.seo_content_briefs(id) on delete restrict,
  page_id uuid references public.seo_pages(id) on delete set null,
  assignee_id uuid not null references public.content_members(user_id) on delete restrict,
  assignment_role text not null check (assignment_role in ('researcher', 'brief_lead', 'writer', 'editor', 'reviewer', 'publisher')),
  status text not null default 'assigned' check (status in ('assigned', 'accepted', 'in_progress', 'blocked', 'submitted', 'completed', 'reassigned', 'cancelled')),
  assigned_by uuid references public.content_members(user_id) on delete set null,
  priority smallint not null default 50 check (priority between 0 and 100),
  due_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  notes text check (notes is null or char_length(notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists seo_content_assignments_active_role_idx
  on public.seo_content_assignments (brief_id, assignment_role)
  where status not in ('completed', 'reassigned', 'cancelled');
create index if not exists seo_content_assignments_assignee_queue_idx
  on public.seo_content_assignments (assignee_id, status, due_at);
create index if not exists seo_content_assignments_brief_idx
  on public.seo_content_assignments (brief_id, created_at desc);

create table if not exists public.seo_review_decisions (
  id uuid primary key default gen_random_uuid(),
  brief_id uuid not null references public.seo_content_briefs(id) on delete restrict,
  page_id uuid references public.seo_pages(id) on delete set null,
  packet_id uuid references public.seo_evidence_packets(id) on delete set null,
  review_type text not null check (review_type in ('research', 'rights', 'workflow', 'draft', 'quality', 'editorial', 'publish', 'refresh')),
  decision text not null check (decision in ('approved', 'changes_requested', 'rejected', 'merged', 'deferred')),
  content_version text not null check (char_length(content_version) between 1 and 120),
  reviewer_id uuid not null references public.content_members(user_id) on delete restrict,
  score smallint check (score is null or score between 0 and 100),
  checklist jsonb not null default '{}'::jsonb check (jsonb_typeof(checklist) = 'object'),
  blockers text[] not null default '{}',
  notes text check (notes is null or char_length(notes) <= 8000),
  created_at timestamptz not null default now()
);

create index if not exists seo_review_decisions_brief_created_idx
  on public.seo_review_decisions (brief_id, created_at desc);
create index if not exists seo_review_decisions_page_created_idx
  on public.seo_review_decisions (page_id, created_at desc)
  where page_id is not null;
create index if not exists seo_review_decisions_queue_idx
  on public.seo_review_decisions (review_type, decision, created_at desc);

create table if not exists public.seo_content_audit_events (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('brief', 'evidence_packet', 'evidence_item', 'assignment', 'review_decision')),
  entity_id uuid not null,
  action text not null check (action ~ '^[a-z][a-z0-9_.-]{1,79}$'),
  actor_id uuid references auth.users(id) on delete set null,
  from_status text,
  to_status text,
  request_id text check (request_id is null or char_length(request_id) between 8 and 180),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists seo_content_audit_events_entity_idx
  on public.seo_content_audit_events (entity_type, entity_id, occurred_at desc);
create index if not exists seo_content_audit_events_actor_idx
  on public.seo_content_audit_events (actor_id, occurred_at desc)
  where actor_id is not null;
create index if not exists seo_content_audit_events_action_idx
  on public.seo_content_audit_events (action, occurred_at desc);

-- Add a few constraints when this migration is replayed against a partially
-- created local database. Existing rows are not changed or deleted.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'seo_evidence_packets_packet_checksum_sha256'
      and conrelid = 'public.seo_evidence_packets'::regclass
  ) then
    alter table public.seo_evidence_packets
      add constraint seo_evidence_packets_packet_checksum_sha256
      check (packet_checksum is null or packet_checksum ~ '^[a-f0-9]{64}$');
  end if;
end;
$$;

create or replace function public.validate_seo_evidence_packet()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  item_count integer;
begin
  if new.status in ('submitted', 'approved') and new.packet_checksum is null then
    raise exception 'Submitted or approved evidence packets require a SHA-256 checksum.';
  end if;
  if new.status = 'approved' and (new.reviewed_by is null or new.reviewed_at is null) then
    raise exception 'Approved evidence packets require a reviewer and review timestamp.';
  end if;
  if new.rights_status = 'approved' and (new.reviewed_by is null or new.reviewed_at is null) then
    raise exception 'Approved rights packets require a reviewer and review timestamp.';
  end if;

  -- A packet is normally assembled as draft/submitted first and approved in
  -- a later update. On an INSERT, the item rows cannot exist yet because of
  -- the packet foreign key, so defer the item-level completeness check until
  -- the approval update.
  if new.status = 'approved' and tg_op = 'INSERT' then
    raise exception 'Create and populate an evidence packet before approving it.';
  end if;

  if new.status = 'approved' then
    select count(*) into item_count from public.seo_evidence_items where packet_id = new.id;
    if new.packet_type = 'research' and item_count < 3 then
      raise exception 'Approved research packets require at least three evidence items.';
    end if;
    if new.packet_type = 'rights' and not exists (
      select 1 from public.seo_evidence_items
      where packet_id = new.id and item_type = 'rights'
        and rights_status = 'approved' and rights_evidence_id is not null
    ) then
      raise exception 'Approved rights packets require an approved rights evidence item.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists seo_evidence_packets_validate on public.seo_evidence_packets;
create trigger seo_evidence_packets_validate
before insert or update on public.seo_evidence_packets
for each row execute function public.validate_seo_evidence_packet();

create or replace function public.validate_seo_assignment_member()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  member_role text;
begin
  select role into member_role
    from public.content_members
   where user_id = new.assignee_id and is_active = true;
  if member_role is null then
    raise exception 'SEO assignments require an active content member.';
  end if;

  if new.assignment_role = 'writer' and member_role not in ('writer', 'editor', 'seo_admin') then
    raise exception 'Writer assignments require a writer, editor, or SEO-admin member.';
  end if;
  if new.assignment_role in ('researcher', 'brief_lead') and member_role not in ('brief_lead', 'editor', 'seo_admin') then
    raise exception 'Research assignments require a brief lead, editor, or SEO-admin member.';
  end if;
  if new.assignment_role in ('editor', 'reviewer') and member_role not in ('editor', 'publisher', 'seo_admin') then
    raise exception 'Review assignments require an editor, publisher, or SEO-admin member.';
  end if;
  if new.assignment_role = 'publisher' and member_role not in ('publisher', 'seo_admin') then
    raise exception 'Publisher assignments require a publisher or SEO-admin member.';
  end if;
  if new.status in ('completed', 'cancelled') then
    new.completed_at := coalesce(new.completed_at, now());
  end if;
  if new.status in ('accepted', 'in_progress', 'blocked', 'submitted') then
    new.started_at := coalesce(new.started_at, now());
  end if;
  return new;
end;
$$;

drop trigger if exists seo_content_assignments_validate on public.seo_content_assignments;
create trigger seo_content_assignments_validate
before insert or update on public.seo_content_assignments
for each row execute function public.validate_seo_assignment_member();

create or replace function public.validate_seo_review_reviewer()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  member_role text;
begin
  select role into member_role
    from public.content_members
   where user_id = new.reviewer_id and is_active = true;
  if member_role is null or member_role not in ('editor', 'publisher', 'seo_admin') then
    raise exception 'SEO review decisions require an active editor, publisher, or SEO-admin reviewer.';
  end if;
  return new;
end;
$$;

drop trigger if exists seo_review_decisions_validate on public.seo_review_decisions;
create trigger seo_review_decisions_validate
before insert or update on public.seo_review_decisions
for each row execute function public.validate_seo_review_reviewer();

create or replace function public.append_seo_content_audit_event(
  p_entity_type text,
  p_entity_id uuid,
  p_action text,
  p_actor_id uuid default null,
  p_from_status text default null,
  p_to_status text default null,
  p_request_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  audit_id uuid;
begin
  if p_entity_type not in ('brief', 'evidence_packet', 'evidence_item', 'assignment', 'review_decision') then
    raise exception 'Unsupported SEO audit entity type.';
  end if;
  if p_entity_id is null or p_action is null or p_action !~ '^[a-z][a-z0-9_.-]{1,79}$' then
    raise exception 'SEO audit event identity is invalid.';
  end if;
  insert into public.seo_content_audit_events (
    entity_type, entity_id, action, actor_id, from_status, to_status,
    request_id, metadata
  ) values (
    p_entity_type, p_entity_id, p_action, coalesce(p_actor_id, auth.uid()),
    p_from_status, p_to_status, p_request_id, coalesce(p_metadata, '{}'::jsonb)
  ) returning id into audit_id;
  return audit_id;
end;
$$;

create or replace function public.audit_seo_content_operation()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  entity_type text;
  entity_id uuid;
  before_status text;
  after_status text;
  actor_id uuid := auth.uid();
  row_data jsonb;
begin
  entity_type := case tg_table_name
    when 'seo_content_briefs' then 'brief'
    when 'seo_evidence_packets' then 'evidence_packet'
    when 'seo_evidence_items' then 'evidence_item'
    when 'seo_content_assignments' then 'assignment'
    when 'seo_review_decisions' then 'review_decision'
  end;
  row_data := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  entity_id := (row_data->>'id')::uuid;
  before_status := case when tg_op = 'INSERT' then null else to_jsonb(old)->>'status' end;
  after_status := case when tg_op = 'DELETE' then null else to_jsonb(new)->>'status' end;

  if actor_id is null then
    begin
      actor_id := coalesce(
        nullif(row_data->>'created_by', '')::uuid,
        nullif(row_data->>'assigned_by', '')::uuid,
        nullif(row_data->>'reviewer_id', '')::uuid,
        nullif(row_data->>'collected_by', '')::uuid
      );
    exception when invalid_text_representation then
      actor_id := null;
    end;
  end if;

  perform public.append_seo_content_audit_event(
    entity_type,
    entity_id,
    lower(tg_op),
    actor_id,
    before_status,
    after_status,
    null,
    jsonb_build_object('table', tg_table_name)
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists seo_content_briefs_audit on public.seo_content_briefs;
create trigger seo_content_briefs_audit
after insert or update or delete on public.seo_content_briefs
for each row execute function public.audit_seo_content_operation();

drop trigger if exists seo_evidence_packets_audit on public.seo_evidence_packets;
create trigger seo_evidence_packets_audit
after insert or update or delete on public.seo_evidence_packets
for each row execute function public.audit_seo_content_operation();

drop trigger if exists seo_evidence_items_audit on public.seo_evidence_items;
create trigger seo_evidence_items_audit
after insert or update or delete on public.seo_evidence_items
for each row execute function public.audit_seo_content_operation();

drop trigger if exists seo_content_assignments_audit on public.seo_content_assignments;
create trigger seo_content_assignments_audit
after insert or update or delete on public.seo_content_assignments
for each row execute function public.audit_seo_content_operation();

drop trigger if exists seo_review_decisions_audit on public.seo_review_decisions;
create trigger seo_review_decisions_audit
after insert or update or delete on public.seo_review_decisions
for each row execute function public.audit_seo_content_operation();

create or replace function public.prevent_seo_audit_event_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'SEO audit events are append-only; add a compensating event instead.';
end;
$$;

drop trigger if exists seo_content_audit_events_immutable on public.seo_content_audit_events;
create trigger seo_content_audit_events_immutable
before update or delete on public.seo_content_audit_events
for each row execute function public.prevent_seo_audit_event_mutation();

-- Content operation rows are archived/statused rather than physically deleted.
create or replace function public.prevent_seo_content_operation_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'SEO content operation records are non-destructive; archive or supersede the row instead.';
end;
$$;

drop trigger if exists seo_content_briefs_no_delete on public.seo_content_briefs;
create trigger seo_content_briefs_no_delete before delete on public.seo_content_briefs for each row execute function public.prevent_seo_content_operation_delete();
drop trigger if exists seo_evidence_packets_no_delete on public.seo_evidence_packets;
create trigger seo_evidence_packets_no_delete before delete on public.seo_evidence_packets for each row execute function public.prevent_seo_content_operation_delete();
drop trigger if exists seo_evidence_items_no_delete on public.seo_evidence_items;
create trigger seo_evidence_items_no_delete before delete on public.seo_evidence_items for each row execute function public.prevent_seo_content_operation_delete();
drop trigger if exists seo_content_assignments_no_delete on public.seo_content_assignments;
create trigger seo_content_assignments_no_delete before delete on public.seo_content_assignments for each row execute function public.prevent_seo_content_operation_delete();
drop trigger if exists seo_review_decisions_no_delete on public.seo_review_decisions;
create trigger seo_review_decisions_no_delete before delete on public.seo_review_decisions for each row execute function public.prevent_seo_content_operation_delete();

-- Keep the existing timestamp convention for mutable operating records.
drop trigger if exists seo_content_briefs_updated_at on public.seo_content_briefs;
create trigger seo_content_briefs_updated_at before update on public.seo_content_briefs for each row execute function public.set_seo_updated_at();
drop trigger if exists seo_evidence_packets_updated_at on public.seo_evidence_packets;
create trigger seo_evidence_packets_updated_at before update on public.seo_evidence_packets for each row execute function public.set_seo_updated_at();
drop trigger if exists seo_content_assignments_updated_at on public.seo_content_assignments;
create trigger seo_content_assignments_updated_at before update on public.seo_content_assignments for each row execute function public.set_seo_updated_at();

alter table public.seo_content_briefs enable row level security;
alter table public.seo_evidence_packets enable row level security;
alter table public.seo_evidence_items enable row level security;
alter table public.seo_content_assignments enable row level security;
alter table public.seo_review_decisions enable row level security;
alter table public.seo_content_audit_events enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'seo_content_briefs' and policyname = 'Active content members can read SEO briefs') then
    create policy "Active content members can read SEO briefs" on public.seo_content_briefs for select to authenticated using (public.is_active_content_member());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'seo_content_briefs' and policyname = 'Brief leads can create SEO briefs') then
    create policy "Brief leads can create SEO briefs" on public.seo_content_briefs for insert to authenticated with check (public.can_brief_seo_content() and (created_by is null or created_by = (select auth.uid())));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'seo_content_briefs' and policyname = 'Brief leads can update SEO briefs') then
    create policy "Brief leads can update SEO briefs" on public.seo_content_briefs for update to authenticated using (public.can_brief_seo_content()) with check (public.can_brief_seo_content());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'seo_evidence_packets' and policyname = 'Active content members can read SEO evidence packets') then
    create policy "Active content members can read SEO evidence packets" on public.seo_evidence_packets for select to authenticated using (public.is_active_content_member());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'seo_evidence_packets' and policyname = 'Content members can create SEO evidence packets') then
    create policy "Content members can create SEO evidence packets" on public.seo_evidence_packets for insert to authenticated with check (public.is_active_content_member() and (collected_by is null or collected_by = (select auth.uid())));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'seo_evidence_packets' and policyname = 'Editors can update SEO evidence packets') then
    create policy "Editors can update SEO evidence packets" on public.seo_evidence_packets for update to authenticated using (public.can_edit_all_seo_content()) with check (public.can_edit_all_seo_content());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'seo_evidence_items' and policyname = 'Active content members can read SEO evidence items') then
    create policy "Active content members can read SEO evidence items" on public.seo_evidence_items for select to authenticated using (public.is_active_content_member());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'seo_evidence_items' and policyname = 'Content members can create SEO evidence items') then
    create policy "Content members can create SEO evidence items" on public.seo_evidence_items for insert to authenticated with check (public.is_active_content_member() and (collected_by is null or collected_by = (select auth.uid())));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'seo_evidence_items' and policyname = 'Editors can update SEO evidence items') then
    create policy "Editors can update SEO evidence items" on public.seo_evidence_items for update to authenticated using (public.can_edit_all_seo_content()) with check (public.can_edit_all_seo_content());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'seo_content_assignments' and policyname = 'Assigned content members can read SEO assignments') then
    create policy "Assigned content members can read SEO assignments" on public.seo_content_assignments for select to authenticated using (public.is_active_content_member() and (assignee_id = (select auth.uid()) or assigned_by = (select auth.uid()) or public.can_edit_all_seo_content()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'seo_content_assignments' and policyname = 'Brief leads can create SEO assignments') then
    create policy "Brief leads can create SEO assignments" on public.seo_content_assignments for insert to authenticated with check (public.can_brief_seo_content() and (assigned_by is null or assigned_by = (select auth.uid())));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'seo_content_assignments' and policyname = 'Assignees can update SEO assignments') then
    create policy "Assignees can update SEO assignments" on public.seo_content_assignments for update to authenticated using (assignee_id = (select auth.uid()) or public.can_edit_all_seo_content()) with check (assignee_id = (select auth.uid()) or public.can_edit_all_seo_content());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'seo_review_decisions' and policyname = 'Active content members can read SEO review decisions') then
    create policy "Active content members can read SEO review decisions" on public.seo_review_decisions for select to authenticated using (public.is_active_content_member());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'seo_review_decisions' and policyname = 'Editors can create SEO review decisions') then
    create policy "Editors can create SEO review decisions" on public.seo_review_decisions for insert to authenticated with check (public.can_edit_all_seo_content() and reviewer_id = (select auth.uid()));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'seo_content_audit_events' and policyname = 'Active content members can read SEO audit events') then
    create policy "Active content members can read SEO audit events" on public.seo_content_audit_events for select to authenticated using (public.is_active_content_member());
  end if;
end;
$$;

revoke all on public.seo_content_briefs, public.seo_evidence_packets, public.seo_evidence_items,
  public.seo_content_assignments, public.seo_review_decisions, public.seo_content_audit_events
  from anon;
revoke all on public.seo_content_audit_events from authenticated;
grant select, insert, update on public.seo_content_briefs to authenticated;
grant select, insert, update on public.seo_evidence_packets, public.seo_evidence_items to authenticated;
grant select, insert, update on public.seo_content_assignments to authenticated;
grant select, insert on public.seo_review_decisions to authenticated;
grant select on public.seo_content_audit_events to authenticated;

revoke all on function public.append_seo_content_audit_event(text, uuid, text, uuid, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.append_seo_content_audit_event(text, uuid, text, uuid, text, text, text, jsonb) to service_role;

-- Dashboard reads stay aggregate-only. This avoids loading years of brief,
-- assignment, or audit rows into the application just to render queue counts.
create or replace function public.get_seo_operations_summary()
returns jsonb
language sql
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'generatedAt', now(),
    'briefsByStatus', coalesce((
      select jsonb_object_agg(status, total)
      from (
        select status, count(*)::integer as total
        from public.seo_content_briefs
        group by status
      ) grouped_briefs
    ), '{}'::jsonb),
    'activeAssignments', (
      select count(*)::integer
      from public.seo_content_assignments
      where status not in ('completed', 'reassigned', 'cancelled')
    ),
    'reviewQueue', (
      select count(*)::integer
      from public.seo_content_briefs
      where status in ('editor_review', 'changes_requested')
    ),
    'evidenceQueue', (
      select count(*)::integer
      from public.seo_evidence_packets
      where status = 'submitted'
    ),
    'auditEvents', (
      select count(*)::integer
      from public.seo_content_audit_events
    )
  );
$$;
revoke all on function public.get_seo_operations_summary() from public, anon, authenticated;
grant execute on function public.get_seo_operations_summary() to service_role;

revoke all on function public.validate_seo_evidence_packet() from public, anon, authenticated;
revoke all on function public.validate_seo_assignment_member() from public, anon, authenticated;
revoke all on function public.validate_seo_review_reviewer() from public, anon, authenticated;
revoke all on function public.audit_seo_content_operation() from public, anon, authenticated;
revoke all on function public.prevent_seo_audit_event_mutation() from public, anon, authenticated;
revoke all on function public.prevent_seo_content_operation_delete() from public, anon, authenticated;

comment on table public.seo_content_briefs is
  'Research-backed SEO production briefs. A brief is the durable handoff from opportunity research to writer assignment.';
comment on table public.seo_evidence_packets is
  'Versioned research, rights, workflow, editorial, and quality evidence packets attached to a brief.';
comment on table public.seo_evidence_items is
  'Structured evidence items supporting a packet claim, query, source, workflow, or rights decision.';
comment on table public.seo_content_assignments is
  'Role-specific writer, researcher, editor, reviewer, and publisher assignments for a brief.';
comment on table public.seo_review_decisions is
  'Append-only editorial decisions with reviewer identity, content version, score, checklist, and blockers.';
comment on table public.seo_content_audit_events is
  'Append-only audit log for SEO content operations. Corrections use compensating events.';

commit;
