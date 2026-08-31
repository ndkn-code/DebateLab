-- Rendition rows are worker-owned implementation details. Keep service-role
-- access through its RLS bypass, while making the client denial explicit for
-- schema audits and defense in depth.

begin;

drop policy if exists "No direct LMS material rendition access"
  on public.lms_material_renditions;
create policy "No direct LMS material rendition access"
on public.lms_material_renditions
for all
to anon, authenticated
using (false)
with check (false);

commit;
