begin;

-- Recommendation state changes are review actions, not autonomous SEO edits.
-- Terminal rows remain immutable so an operator's outcome cannot be erased;
-- a later recurrence creates a new active row for the same dedupe key.
create or replace function public.validate_seo_recommendation_transition()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if tg_op = 'UPDATE' and old.status <> new.status then
    if old.status in ('completed', 'dismissed', 'expired') then
      raise exception 'Terminal SEO recommendations cannot be reopened or changed.';
    end if;
    if new.status in ('completed', 'dismissed', 'expired') then
      if char_length(trim(coalesce(new.resolution_note, ''))) < 3 then
        raise exception 'Closing an SEO recommendation requires a resolution note.';
      end if;
      new.resolved_at := coalesce(new.resolved_at, now());
    else
      new.resolved_at := null;
      new.resolution_note := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists seo_recommendations_transition on public.seo_recommendations;
create trigger seo_recommendations_transition
before update on public.seo_recommendations
for each row execute function public.validate_seo_recommendation_transition();

create or replace function public.update_seo_recommendation_status(
  p_recommendation_id uuid,
  p_status text,
  p_resolution_note text default null,
  p_assigned_to uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  current_status text;
  recommendation_id uuid;
  note_value text;
begin
  if p_recommendation_id is null then
    raise exception 'SEO recommendation id is required.';
  end if;
  if p_status not in ('open', 'acknowledged', 'in_progress', 'completed', 'dismissed', 'expired') then
    raise exception 'Unsupported SEO recommendation status.';
  end if;
  note_value := nullif(trim(coalesce(p_resolution_note, '')), '');
  if p_status in ('completed', 'dismissed', 'expired') and char_length(coalesce(note_value, '')) < 3 then
    raise exception 'Closing an SEO recommendation requires a resolution note.';
  end if;

  select id, status into recommendation_id, current_status
    from public.seo_recommendations
   where id = p_recommendation_id
   for update;
  if recommendation_id is null then
    raise exception 'SEO recommendation not found.';
  end if;
  if current_status in ('completed', 'dismissed', 'expired') and p_status <> current_status then
    raise exception 'Terminal SEO recommendations cannot be reopened or changed.';
  end if;

  update public.seo_recommendations
     set status = p_status,
         assigned_to = coalesce(p_assigned_to, assigned_to),
         resolution_note = case when p_status in ('completed', 'dismissed', 'expired') then note_value else null end,
         resolved_at = case when p_status in ('completed', 'dismissed', 'expired') then coalesce(resolved_at, now()) else null end
   where id = recommendation_id;
  return recommendation_id;
end;
$$;

revoke all on function public.update_seo_recommendation_status(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.update_seo_recommendation_status(uuid, text, text, uuid) to service_role;

comment on function public.update_seo_recommendation_status(uuid, text, text, uuid) is
  'Review-only recommendation lifecycle transition; does not edit a page, redirect, canonical, or noindex state.';

commit;
