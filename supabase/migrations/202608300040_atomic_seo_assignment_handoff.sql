begin;

-- Keep assignment creation and the brief queue transition atomic. The admin
-- action previously wrote these rows with two independent requests, which
-- could leave an assignment visible while its brief remained unassigned (or
-- the reverse) after a transient failure. Locking the brief also serializes
-- concurrent role assignments for the same queue item.
create or replace function public.assign_seo_brief(
  p_brief_id uuid,
  p_assignee_id uuid,
  p_assignment_role text,
  p_priority integer default 50,
  p_due_at timestamptz default null,
  p_notes text default null,
  p_assigned_by uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
volatile
as $$
declare
  brief_status text;
  assignment_id uuid;
  existing_assignment_id uuid;
  safe_priority integer := coalesce(p_priority, 50);
  safe_notes text := nullif(btrim(p_notes), '');
begin
  if p_brief_id is null or p_assignee_id is null then
    raise exception 'SEO brief and assignee are required.';
  end if;
  if p_assignment_role not in ('researcher', 'brief_lead', 'writer', 'editor', 'reviewer', 'publisher') then
    raise exception 'SEO assignment role is invalid.';
  end if;
  if safe_priority < 0 or safe_priority > 100 then
    raise exception 'SEO assignment priority must be between 0 and 100.';
  end if;
  if safe_notes is not null and char_length(safe_notes) > 4000 then
    raise exception 'SEO assignment notes are too long.';
  end if;

  select b.status
    into brief_status
    from public.seo_content_briefs b
   where b.id = p_brief_id
   for update;
  if not found then
    raise exception 'SEO brief not found.';
  end if;

  select a.id
    into existing_assignment_id
    from public.seo_content_assignments a
   where a.brief_id = p_brief_id
     and a.assignment_role = p_assignment_role
     and a.status not in ('completed', 'reassigned', 'cancelled')
   order by a.created_at desc
   limit 1
   for update;

  if existing_assignment_id is not null then
    update public.seo_content_assignments
       set assignee_id = p_assignee_id,
           assigned_by = p_assigned_by,
           priority = safe_priority::smallint,
           due_at = p_due_at,
           notes = safe_notes,
           status = 'assigned',
           updated_at = now()
     where id = existing_assignment_id
     returning id into assignment_id;
  else
    insert into public.seo_content_assignments (
      brief_id, assignee_id, assignment_role, status, assigned_by,
      priority, due_at, notes
    ) values (
      p_brief_id, p_assignee_id, p_assignment_role, 'assigned', p_assigned_by,
      safe_priority::smallint, p_due_at, safe_notes
    )
    returning id into assignment_id;
  end if;

  if brief_status in ('ready_for_assignment', 'idea', 'researching') then
    update public.seo_content_briefs
       set status = 'assigned', updated_at = now()
     where id = p_brief_id;
  end if;

  return assignment_id;
end;
$$;

revoke all on function public.assign_seo_brief(uuid, uuid, text, integer, timestamptz, text, uuid) from public, anon, authenticated;
grant execute on function public.assign_seo_brief(uuid, uuid, text, integer, timestamptz, text, uuid) to service_role;

comment on function public.assign_seo_brief(uuid, uuid, text, integer, timestamptz, text, uuid) is
  'Atomically upserts one active SEO assignment and advances its brief queue state. Service-role only; assignment triggers still enforce active member role compatibility.';

commit;
