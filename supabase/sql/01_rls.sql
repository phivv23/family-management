-- 01_rls.sql
-- Row Level Security policies for multi-tenant by clan_id
-- Run after 00_schema.sql

-- Enable RLS
alter table public.clans enable row level security;
alter table public.profiles enable row level security;
alter table public.clan_members enable row level security;
alter table public.funds enable row level security;
alter table public.categories enable row level security;
alter table public.vouchers enable row level security;
alter table public.voucher_actions enable row level security;
alter table public.documents enable row level security;
alter table public.attachments enable row level security;
alter table public.voucher_attachments enable row level security;
alter table public.document_attachments enable row level security;
alter table public.members enable row level security;
alter table public.member_parent_child enable row level security;
alter table public.member_spouses enable row level security;
alter table public.events enable row level security;
alter table public.action_logs enable row level security;
alter table public.clan_invitations enable row level security;

-- =========================
-- profiles: owner only
-- =========================
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
for select using (user_id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
for update using (user_id = auth.uid())
with check (user_id = auth.uid());

-- =========================
-- clans: members can read
-- =========================
drop policy if exists "clans_select_member" on public.clans;
create policy "clans_select_member" on public.clans
for select using (id = public.current_clan_id() and public.has_active_clan_membership());

-- =========================
-- clan_members: members can read membership list (needed for RBAC checks)
-- =========================
drop policy if exists "clan_members_select_member" on public.clan_members;
create policy "clan_members_select_member" on public.clan_members
for select using (clan_id = public.current_clan_id() and public.has_active_clan_membership());

-- =========================
-- Common helper: read tables by clan membership
-- =========================
-- funds
drop policy if exists "funds_select_member" on public.funds;
create policy "funds_select_member" on public.funds
for select using (clan_id = public.current_clan_id() and public.has_active_clan_membership());

-- categories
drop policy if exists "categories_select_member" on public.categories;
create policy "categories_select_member" on public.categories
for select using (clan_id = public.current_clan_id() and public.has_active_clan_membership());

-- vouchers
drop policy if exists "vouchers_select_member" on public.vouchers;
create policy "vouchers_select_member" on public.vouchers
for select using (clan_id = public.current_clan_id() and public.has_active_clan_membership());

-- voucher_actions
drop policy if exists "voucher_actions_select_member" on public.voucher_actions;
create policy "voucher_actions_select_member" on public.voucher_actions
for select using (clan_id = public.current_clan_id() and public.has_active_clan_membership());

-- documents
drop policy if exists "documents_select_member" on public.documents;
create policy "documents_select_member" on public.documents
for select using (clan_id = public.current_clan_id() and public.has_active_clan_membership());

-- attachments
drop policy if exists "attachments_select_member" on public.attachments;
create policy "attachments_select_member" on public.attachments
for select using (clan_id = public.current_clan_id() and public.has_active_clan_membership());

-- voucher_attachments
drop policy if exists "voucher_attachments_select_member" on public.voucher_attachments;
create policy "voucher_attachments_select_member" on public.voucher_attachments
for select using (clan_id = public.current_clan_id() and public.has_active_clan_membership());

-- document_attachments
drop policy if exists "document_attachments_select_member" on public.document_attachments;
create policy "document_attachments_select_member" on public.document_attachments
for select using (clan_id = public.current_clan_id() and public.has_active_clan_membership());

-- members
drop policy if exists "members_select_member" on public.members;
create policy "members_select_member" on public.members
for select using (clan_id = public.current_clan_id() and public.has_active_clan_membership());

-- relationships
drop policy if exists "member_parent_child_select_member" on public.member_parent_child;
create policy "member_parent_child_select_member" on public.member_parent_child
for select using (clan_id = public.current_clan_id() and public.has_active_clan_membership());

drop policy if exists "member_spouses_select_member" on public.member_spouses;
create policy "member_spouses_select_member" on public.member_spouses
for select using (clan_id = public.current_clan_id() and public.has_active_clan_membership());

-- events
drop policy if exists "events_select_member" on public.events;
create policy "events_select_member" on public.events
for select using (clan_id = public.current_clan_id() and public.has_active_clan_membership());

-- clan_invitations: only admin / clan_manager can manage invites in active clan
drop policy if exists "clan_invitations_select_admin" on public.clan_invitations;
create policy "clan_invitations_select_admin" on public.clan_invitations
for select using (
  clan_id = public.current_clan_id()
  and public.user_role_in_clan(public.current_clan_id()) in ('admin','clan_manager')
);

-- action_logs: only admin / clan_manager
drop policy if exists "action_logs_select_admin" on public.action_logs;
create policy "action_logs_select_admin" on public.action_logs
for select using (
  clan_id = public.current_clan_id()
  and public.user_role_in_clan(public.current_clan_id()) in ('admin','clan_manager')
);

-- NOTE:
-- We intentionally do NOT create insert/update/delete policies for most tables.
-- Data writes should go through SECURITY DEFINER RPCs, so direct table writes are denied by RLS.


-- =========================
-- SIX UPGRADES MVP EXTENSIONS
-- =========================
alter table public.notifications enable row level security;
alter table public.member_update_requests enable row level security;

drop policy if exists "notifications_select_member" on public.notifications;
create policy "notifications_select_member" on public.notifications
for select using (clan_id = public.current_clan_id() and public.has_active_clan_membership());

drop policy if exists "member_update_requests_select_own_or_admin" on public.member_update_requests;
create policy "member_update_requests_select_own_or_admin" on public.member_update_requests
for select using (
  clan_id = public.current_clan_id()
  and (
    requested_by = auth.uid()
    or public.user_role_in_clan(public.current_clan_id()) in ('admin','clan_manager')
  )
);

-- documents: hide manager-only documents from normal members
drop policy if exists "documents_select_member" on public.documents;
create policy "documents_select_member" on public.documents
for select using (
  clan_id = public.current_clan_id()
  and public.has_active_clan_membership()
  and (coalesce(visibility, 'CLAN') <> 'MANAGER_ONLY' or public.user_role_in_clan(public.current_clan_id()) in ('admin','clan_manager'))
);
