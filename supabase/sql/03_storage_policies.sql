-- 03_storage_policies.sql
-- Storage setup (Supabase Storage)
-- Bucket: clan-files (private)
-- Object path prefix:
--  - {clanId}/vouchers/{voucherId}/...
--  - {clanId}/documents/{documentId}/...
--
-- Read is granted only when there is a matching row in public.attachments AND user belongs to that clan.
-- Upload is restricted by path + role, using profiles.active_clan_id.

-- Helper for upload permission
create or replace function public.storage_object_allowed_upload(p_name text)
returns boolean
language sql
stable
set search_path = public
as $$
  select
    public.current_clan_id() is not null
    and (
      (
        p_name like (public.current_clan_id()::text || '/vouchers/%')
        and public.user_role_in_clan(public.current_clan_id()) in ('admin','clan_manager','treasurer','member')
      )
      or
      (
        p_name like (public.current_clan_id()::text || '/documents/%')
        and public.user_role_in_clan(public.current_clan_id()) in ('admin','clan_manager')
      )
    );
$$;

-- Bucket must exist; create via UI or SQL (Supabase supports storage.create_bucket in newer versions).
-- If you prefer SQL and your project allows it:
-- select storage.create_bucket('clan-files', public := false);

-- READ policy
drop policy if exists "clan_files_read_member" on storage.objects;
create policy "clan_files_read_member"
on storage.objects for select
using (
  bucket_id = 'clan-files'
  and exists (
    select 1
    from public.attachments a
    where a.bucket = storage.objects.bucket_id
      and a.object_path = storage.objects.name
      and public.is_clan_member(a.clan_id)
  )
);

-- UPLOAD policy
drop policy if exists "clan_files_insert_role_path" on storage.objects;
create policy "clan_files_insert_role_path"
on storage.objects for insert
with check (
  bucket_id = 'clan-files'
  and auth.uid() is not null
  and public.storage_object_allowed_upload(name)
);


-- DELETE / CLEANUP policy
 drop policy if exists "clan_files_delete_role_path" on storage.objects;
create policy "clan_files_delete_role_path"
on storage.objects for delete
using (
  bucket_id = 'clan-files'
  and auth.uid() is not null
  and public.storage_object_allowed_upload(name)
);
