-- 05_permissions_and_read_visibility_fix.sql
-- Fix for case: SECURITY DEFINER RPC writes succeed, but normal SELECT pages return empty / 404
-- because authenticated role has RLS policies but lacks plain table GRANT privileges.

grant usage on schema public to anon, authenticated;

-- Tables read directly by the Next.js app via supabase.from(...).select(...)
grant select on table
  public.clans,
  public.profiles,
  public.clan_members,
  public.funds,
  public.categories,
  public.vouchers,
  public.voucher_actions,
  public.documents,
  public.attachments,
  public.voucher_attachments,
  public.document_attachments,
  public.members,
  public.member_parent_child,
  public.member_spouses,
  public.events,
  public.action_logs,
  public.clan_invitations,
  public.notifications,
  public.member_update_requests
to authenticated;

-- The app updates own profile directly in a few places (for example after accepting invitation).
grant insert, update on table public.profiles to authenticated;

-- Keep future tables readable by authenticated if they are created by postgres in public schema.
alter default privileges for role postgres in schema public
grant select on tables to authenticated;

alter default privileges for role postgres in schema public
grant insert, update on tables to authenticated;
