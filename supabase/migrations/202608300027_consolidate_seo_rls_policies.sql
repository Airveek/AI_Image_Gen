begin;

-- Split broad FOR ALL policies into operation-specific policies. The prior
-- read + FOR ALL combination was semantically correct but caused PostgreSQL
-- to evaluate two permissive SELECT policies for every row. The predicates
-- below preserve the old read/manage boundaries while leaving SELECT with a
-- single policy per table.

-- Content membership
drop policy if exists "Members can read their content membership" on public.content_members;
drop policy if exists "SEO admins can manage content memberships" on public.content_members;
create policy "Members and editors can read content memberships"
  on public.content_members for select to authenticated
  using (user_id = (select auth.uid()) or public.can_edit_all_seo_content() or public.content_member_role() = 'seo_admin');
create policy "SEO admins can insert content memberships"
  on public.content_members for insert to authenticated
  with check (public.content_member_role() = 'seo_admin');
create policy "SEO admins can update content memberships"
  on public.content_members for update to authenticated
  using (public.content_member_role() = 'seo_admin')
  with check (public.content_member_role() = 'seo_admin');
create policy "SEO admins can delete content memberships"
  on public.content_members for delete to authenticated
  using (public.content_member_role() = 'seo_admin');

-- Page evidence links
drop policy if exists "Content members can read page evidence links" on public.seo_page_generation_runs;
drop policy if exists "Page editors can manage page evidence links" on public.seo_page_generation_runs;
create policy "Members and editors can read page evidence links"
  on public.seo_page_generation_runs for select to authenticated
  using (public.is_active_content_member() or public.can_edit_seo_page(page_id));
create policy "Page editors can insert page evidence links"
  on public.seo_page_generation_runs for insert to authenticated
  with check (public.can_edit_seo_page(page_id));
create policy "Page editors can update page evidence links"
  on public.seo_page_generation_runs for update to authenticated
  using (public.can_edit_seo_page(page_id))
  with check (public.can_edit_seo_page(page_id));
create policy "Page editors can delete page evidence links"
  on public.seo_page_generation_runs for delete to authenticated
  using (public.can_edit_seo_page(page_id));

-- SEO assets
drop policy if exists "Content members can read SEO assets" on public.seo_assets;
drop policy if exists "Page editors can manage SEO assets" on public.seo_assets;
create policy "Members and editors can read SEO assets"
  on public.seo_assets for select to authenticated
  using (public.is_active_content_member() or public.can_edit_seo_page(page_id));
create policy "Page editors can insert SEO assets"
  on public.seo_assets for insert to authenticated
  with check (public.can_edit_seo_page(page_id));
create policy "Page editors can update SEO assets"
  on public.seo_assets for update to authenticated
  using (public.can_edit_seo_page(page_id))
  with check (public.can_edit_seo_page(page_id));
create policy "Page editors can delete SEO assets"
  on public.seo_assets for delete to authenticated
  using (public.can_edit_seo_page(page_id));

-- SEO sources
drop policy if exists "Content members can read SEO sources" on public.seo_sources;
drop policy if exists "Page editors can manage SEO sources" on public.seo_sources;
create policy "Members and editors can read SEO sources"
  on public.seo_sources for select to authenticated
  using (public.is_active_content_member() or public.can_edit_seo_page(page_id));
create policy "Page editors can insert SEO sources"
  on public.seo_sources for insert to authenticated
  with check (public.can_edit_seo_page(page_id));
create policy "Page editors can update SEO sources"
  on public.seo_sources for update to authenticated
  using (public.can_edit_seo_page(page_id))
  with check (public.can_edit_seo_page(page_id));
create policy "Page editors can delete SEO sources"
  on public.seo_sources for delete to authenticated
  using (public.can_edit_seo_page(page_id));

-- Internal links
drop policy if exists "Content members can read internal links" on public.seo_links;
drop policy if exists "Editors can manage internal links" on public.seo_links;
create policy "Members and editors can read internal links"
  on public.seo_links for select to authenticated
  using (public.is_active_content_member() or public.can_edit_all_seo_content());
create policy "Editors can insert internal links"
  on public.seo_links for insert to authenticated
  with check (public.can_edit_all_seo_content());
create policy "Editors can update internal links"
  on public.seo_links for update to authenticated
  using (public.can_edit_all_seo_content())
  with check (public.can_edit_all_seo_content());
create policy "Editors can delete internal links"
  on public.seo_links for delete to authenticated
  using (public.can_edit_all_seo_content());

-- Redirects
drop policy if exists "Content members can read redirects" on public.seo_redirects;
drop policy if exists "Publishers can manage redirects" on public.seo_redirects;
create policy "Members and publishers can read redirects"
  on public.seo_redirects for select to authenticated
  using (public.is_active_content_member() or public.can_publish_seo_content());
create policy "Publishers can insert redirects"
  on public.seo_redirects for insert to authenticated
  with check (public.can_publish_seo_content());
create policy "Publishers can update redirects"
  on public.seo_redirects for update to authenticated
  using (public.can_publish_seo_content())
  with check (public.can_publish_seo_content());
create policy "Publishers can delete redirects"
  on public.seo_redirects for delete to authenticated
  using (public.can_publish_seo_content());

-- Publish batches
drop policy if exists "Content members can read publish batches" on public.seo_publish_batches;
drop policy if exists "Publishers can manage publish batches" on public.seo_publish_batches;
create policy "Members and publishers can read publish batches"
  on public.seo_publish_batches for select to authenticated
  using (public.is_active_content_member() or public.can_publish_seo_content());
create policy "Publishers can insert publish batches"
  on public.seo_publish_batches for insert to authenticated
  with check (public.can_publish_seo_content());
create policy "Publishers can update publish batches"
  on public.seo_publish_batches for update to authenticated
  using (public.can_publish_seo_content())
  with check (public.can_publish_seo_content());
create policy "Publishers can delete publish batches"
  on public.seo_publish_batches for delete to authenticated
  using (public.can_publish_seo_content());

-- Publish batch pages
drop policy if exists "Content members can read publish batch pages" on public.seo_publish_batch_pages;
drop policy if exists "Publishers can manage publish batch pages" on public.seo_publish_batch_pages;
create policy "Members and publishers can read publish batch pages"
  on public.seo_publish_batch_pages for select to authenticated
  using (public.is_active_content_member() or public.can_publish_seo_content());
create policy "Publishers can insert publish batch pages"
  on public.seo_publish_batch_pages for insert to authenticated
  with check (public.can_publish_seo_content());
create policy "Publishers can update publish batch pages"
  on public.seo_publish_batch_pages for update to authenticated
  using (public.can_publish_seo_content())
  with check (public.can_publish_seo_content());
create policy "Publishers can delete publish batch pages"
  on public.seo_publish_batch_pages for delete to authenticated
  using (public.can_publish_seo_content());

-- Template rollouts
drop policy if exists "Content members can read template rollouts" on public.seo_template_rollouts;
drop policy if exists "SEO admins can manage template rollouts" on public.seo_template_rollouts;
create policy "Members and SEO admins can read template rollouts"
  on public.seo_template_rollouts for select to authenticated
  using (public.is_active_content_member() or public.content_member_role() = 'seo_admin');
create policy "SEO admins can insert template rollouts"
  on public.seo_template_rollouts for insert to authenticated
  with check (public.content_member_role() = 'seo_admin');
create policy "SEO admins can update template rollouts"
  on public.seo_template_rollouts for update to authenticated
  using (public.content_member_role() = 'seo_admin')
  with check (public.content_member_role() = 'seo_admin');
create policy "SEO admins can delete template rollouts"
  on public.seo_template_rollouts for delete to authenticated
  using (public.content_member_role() = 'seo_admin');

commit;
