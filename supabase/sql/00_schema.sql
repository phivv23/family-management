-- 00_schema.sql
-- Core schema + functions for Clan Management (Family / Clan)
-- Run in Supabase SQL Editor (SQL mode) AFTER enabling Auth.

create extension if not exists "pgcrypto";

-- =========================
-- Enums
-- =========================
do $$ begin
  create type public.app_role as enum ('admin','clan_manager','treasurer','approver','member');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.gender as enum ('MALE','FEMALE','OTHER','UNKNOWN');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.parent_role as enum ('FATHER','MOTHER','PARENT');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.voucher_type as enum ('INCOME','EXPENSE');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.voucher_status as enum ('DRAFT','PENDING','APPROVED','REJECTED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.event_type as enum ('DEATH_ANNIVERSARY','MEETING','BIRTHDAY','OTHER');
exception when duplicate_object then null; end $$;

-- =========================
-- Utility functions
-- =========================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- =========================
-- Tables
-- =========================
create table if not exists public.clans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  user_id uuid primary key,
  full_name text,
  avatar_url text,
  gender public.gender not null default 'UNKNOWN',
  dob date,
  phone text,
  hometown text,
  address text,
  bio text,
  active_clan_id uuid references public.clans(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clan_members (
  clan_id uuid not null references public.clans(id) on delete cascade,
  user_id uuid not null,
  role public.app_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (clan_id, user_id)
);

-- =========================
-- RBAC helpers (must be after clans/profiles/clan_members tables)
-- =========================

-- current active clan from profiles.active_clan_id
-- SECURITY DEFINER is required here because these helpers are used inside RLS policies.
-- Without it, policies end up recursively reading public.clan_members and become very slow / may timeout.
create or replace function public.current_clan_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.active_clan_id
  from public.profiles p
  where p.user_id = auth.uid()
$$;

grant execute on function public.current_clan_id() to authenticated;

create or replace function public.user_role_in_clan(p_clan_id uuid)
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select cm.role
  from public.clan_members cm
  where cm.clan_id = p_clan_id
    and cm.clan_id = public.current_clan_id()
    and cm.user_id = auth.uid()
$$;

grant execute on function public.user_role_in_clan(uuid) to authenticated;

create or replace function public.is_clan_member(p_clan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.clan_members cm
    where cm.clan_id = p_clan_id
      and cm.clan_id = public.current_clan_id()
      and cm.user_id = auth.uid()
  )
$$;

grant execute on function public.is_clan_member(uuid) to authenticated;

create or replace function public.has_active_clan_membership()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.clan_members cm
    where cm.clan_id = public.current_clan_id()
      and cm.user_id = auth.uid()
  )
$$;

grant execute on function public.has_active_clan_membership() to authenticated;




create index if not exists idx_clan_members_user on public.clan_members(user_id);

create table if not exists public.funds (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans(id) on delete cascade,
  name text not null,
  description text,
  currency text not null default 'VND',
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_funds_clan on public.funds(clan_id);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans(id) on delete cascade,
  voucher_type public.voucher_type not null,
  name text not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (clan_id, voucher_type, name)
);

create index if not exists idx_categories_clan on public.categories(clan_id);

create table if not exists public.vouchers (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans(id) on delete cascade,
  fund_id uuid not null references public.funds(id) on delete restrict,
  category_id uuid references public.categories(id) on delete set null,
  voucher_type public.voucher_type not null,
  title text not null,
  description text,
  amount numeric not null check (amount >= 0),
  voucher_date date not null,
  status public.voucher_status not null default 'DRAFT',
  related_voucher_id uuid references public.vouchers(id) on delete set null,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_vouchers_clan on public.vouchers(clan_id);
create index if not exists idx_vouchers_fund on public.vouchers(fund_id);
create index if not exists idx_vouchers_date on public.vouchers(voucher_date);
create index if not exists idx_vouchers_related on public.vouchers(related_voucher_id);

create table if not exists public.voucher_actions (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans(id) on delete cascade,
  voucher_id uuid not null references public.vouchers(id) on delete cascade,
  action text not null,
  note jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_voucher_actions_voucher on public.voucher_actions(voucher_id);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans(id) on delete cascade,
  title text not null,
  description text,
  doc_type text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_documents_clan on public.documents(clan_id);

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans(id) on delete cascade,
  bucket text not null,
  object_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint not null default 0,
  checksum text,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (bucket, object_path)
);

create index if not exists idx_attachments_clan on public.attachments(clan_id);

create table if not exists public.voucher_attachments (
  clan_id uuid not null references public.clans(id) on delete cascade,
  voucher_id uuid not null references public.vouchers(id) on delete cascade,
  attachment_id uuid not null references public.attachments(id) on delete cascade,
  created_by uuid,
  created_at timestamptz not null default now(),
  primary key (voucher_id, attachment_id)
);

create index if not exists idx_voucher_attachments_clan on public.voucher_attachments(clan_id);

create table if not exists public.document_attachments (
  clan_id uuid not null references public.clans(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  attachment_id uuid not null references public.attachments(id) on delete cascade,
  created_by uuid,
  created_at timestamptz not null default now(),
  primary key (document_id, attachment_id)
);

create index if not exists idx_document_attachments_clan on public.document_attachments(clan_id);

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans(id) on delete cascade,
  full_name text not null,
  gender public.gender not null default 'UNKNOWN',
  dob date,
  dod date,
  bio text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_members_clan on public.members(clan_id);
create index if not exists idx_members_name on public.members(full_name);

create table if not exists public.member_parent_child (
  clan_id uuid not null references public.clans(id) on delete cascade,
  parent_id uuid not null references public.members(id) on delete cascade,
  child_id uuid not null references public.members(id) on delete cascade,
  parent_role public.parent_role not null default 'PARENT',
  created_by uuid,
  created_at timestamptz not null default now(),
  primary key (parent_id, child_id),
  check (parent_id <> child_id)
);

create table if not exists public.member_spouses (
  clan_id uuid not null references public.clans(id) on delete cascade,
  member_a_id uuid not null references public.members(id) on delete cascade,
  member_b_id uuid not null references public.members(id) on delete cascade,
  created_by uuid,
  created_at timestamptz not null default now(),
  primary key (member_a_id, member_b_id),
  check (member_a_id <> member_b_id)
);

create index if not exists idx_member_parent_child_clan_parent on public.member_parent_child(clan_id, parent_id);
create index if not exists idx_member_parent_child_clan_child on public.member_parent_child(clan_id, child_id);
create unique index if not exists uq_member_parent_child_child_father on public.member_parent_child(child_id) where parent_role = 'FATHER';
create unique index if not exists uq_member_parent_child_child_mother on public.member_parent_child(child_id) where parent_role = 'MOTHER';
create index if not exists idx_member_spouses_clan_a on public.member_spouses(clan_id, member_a_id);
create index if not exists idx_member_spouses_clan_b on public.member_spouses(clan_id, member_b_id);
create index if not exists idx_vouchers_clan_status_date on public.vouchers(clan_id, status, voucher_date);
create index if not exists idx_vouchers_clan_created_at on public.vouchers(clan_id, created_at desc);
create index if not exists idx_documents_clan_created_at on public.documents(clan_id, created_at desc);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans(id) on delete cascade,
  title text not null,
  event_type public.event_type not null default 'OTHER',
  event_date date not null,
  member_id uuid references public.members(id) on delete set null,
  note text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_events_clan_date on public.events(clan_id, event_date);


create table if not exists public.clan_invitations (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans(id) on delete cascade,
  email text not null,
  role public.app_role not null default 'member',
  member_id uuid references public.members(id) on delete set null,
  token text not null unique,
  status text not null default 'PENDING' check (status in ('PENDING','ACCEPTED','CANCELLED','EXPIRED')),
  note text,
  invited_by uuid,
  accepted_by uuid,
  accepted_at timestamptz,
  expires_at timestamptz not null default (now() + interval '14 day'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_clan_invitations_clan_status on public.clan_invitations(clan_id, status, created_at desc);
create index if not exists idx_clan_invitations_email on public.clan_invitations(lower(email));
create unique index if not exists uq_clan_invitations_pending_email on public.clan_invitations(clan_id, lower(email)) where status = 'PENDING';
create unique index if not exists uq_clan_invitations_pending_member on public.clan_invitations(clan_id, member_id) where status = 'PENDING' and member_id is not null;

create table if not exists public.action_logs (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans(id) on delete cascade,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  metadata jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_action_logs_clan on public.action_logs(clan_id);
create index if not exists idx_action_logs_created on public.action_logs(created_at);

-- =========================
-- Triggers
-- =========================
drop trigger if exists trg_clans_updated_at on public.clans;
create trigger trg_clans_updated_at before update on public.clans
for each row execute function public.set_updated_at();

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_funds_updated_at on public.funds;
create trigger trg_funds_updated_at before update on public.funds
for each row execute function public.set_updated_at();

drop trigger if exists trg_vouchers_updated_at on public.vouchers;
create trigger trg_vouchers_updated_at before update on public.vouchers
for each row execute function public.set_updated_at();

drop trigger if exists trg_documents_updated_at on public.documents;
create trigger trg_documents_updated_at before update on public.documents
for each row execute function public.set_updated_at();

drop trigger if exists trg_members_updated_at on public.members;
create trigger trg_members_updated_at before update on public.members
for each row execute function public.set_updated_at();

drop trigger if exists trg_events_updated_at on public.events;
create trigger trg_events_updated_at before update on public.events
for each row execute function public.set_updated_at();

drop trigger if exists trg_clan_invitations_updated_at on public.clan_invitations;
create trigger trg_clan_invitations_updated_at before update on public.clan_invitations
for each row execute function public.set_updated_at();

-- =========================
-- Logging helpers
-- =========================
create or replace function public.log_action(
  p_clan_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_action text,
  p_metadata jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.action_logs(clan_id, entity_type, entity_id, action, metadata, created_by)
  values (p_clan_id, p_entity_type, p_entity_id, p_action, p_metadata, auth.uid());
end $$;

grant execute on function public.log_action(uuid, text, uuid, text, jsonb) to authenticated;

create or replace function public.log_voucher_action(p_voucher_id uuid, p_action text, p_note jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clan_id uuid;
  v_linked_member_id uuid;
begin
  select clan_id into v_clan_id from public.vouchers where id = p_voucher_id;
  if v_clan_id is null then return; end if;

  insert into public.voucher_actions(clan_id, voucher_id, action, note, created_by)
  values (v_clan_id, p_voucher_id, p_action, p_note, auth.uid());

  perform public.log_action(v_clan_id, 'VOUCHER', p_voucher_id, p_action, p_note);
end $$;

grant execute on function public.log_voucher_action(uuid, text, jsonb) to authenticated;

-- =========================
-- RPC: Onboarding
-- =========================
create or replace function public.create_clan_onboarding(clan_name text, full_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clan_id uuid;
  v_linked_member_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if clan_name is null or length(trim(clan_name)) < 2 then raise exception 'Clan name too short'; end if;

  insert into public.clans(name, created_by) values (trim(clan_name), auth.uid())
  returning id into v_clan_id;

  insert into public.profiles(user_id, full_name, active_clan_id)
  values (auth.uid(), nullif(trim(full_name), ''), v_clan_id)
  on conflict (user_id) do update
    set full_name = excluded.full_name,
        active_clan_id = excluded.active_clan_id;

  insert into public.clan_members(clan_id, user_id, role)
  values (v_clan_id, auth.uid(), 'admin')
  on conflict do nothing;

  if nullif(trim(coalesce(full_name, '')), '') is not null then
    insert into public.members(clan_id, full_name, gender, created_by)
    values (v_clan_id, trim(full_name), 'UNKNOWN', auth.uid())
    returning id into v_linked_member_id;

    update public.clan_members
    set member_id = v_linked_member_id
    where clan_id = v_clan_id and user_id = auth.uid();
  end if;

  -- Seed defaults for new clan
  insert into public.funds(clan_id, name, description, currency, is_active, created_by)
  values (v_clan_id, 'Quỹ chung', 'Quỹ mặc định của dòng họ', 'VND', true, auth.uid());

  insert into public.categories(clan_id, voucher_type, name, created_by) values
    (v_clan_id, 'INCOME', 'Cúng giỗ', auth.uid()),
    (v_clan_id, 'INCOME', 'Đóng góp', auth.uid()),
    (v_clan_id, 'INCOME', 'Tài trợ', auth.uid()),
    (v_clan_id, 'EXPENSE', 'Chi giỗ', auth.uid()),
    (v_clan_id, 'EXPENSE', 'Sửa sang nhà thờ', auth.uid()),
    (v_clan_id, 'EXPENSE', 'Chi khác', auth.uid())
  on conflict do nothing;

  perform public.log_action(v_clan_id, 'CLAN', v_clan_id, 'ONBOARD', jsonb_build_object('user_id', auth.uid()));
  return v_clan_id;
end $$;

grant execute on function public.create_clan_onboarding(text, text) to authenticated;

-- =========================
-- RPC: Members CRUD
-- =========================
create or replace function public.create_member(
  p_full_name text,
  p_gender public.gender,
  p_dob date,
  p_dod date,
  p_bio text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clan_id uuid;
  v_role public.app_role;
  v_id uuid;
begin
  v_clan_id := public.current_clan_id();
  if v_clan_id is null then raise exception 'No active clan'; end if;
  v_role := public.user_role_in_clan(v_clan_id);
  if v_role not in ('admin','clan_manager') then raise exception 'Forbidden'; end if;

  insert into public.members(clan_id, full_name, gender, dob, dod, bio, created_by)
  values (v_clan_id, trim(p_full_name), coalesce(p_gender,'UNKNOWN'), p_dob, p_dod, p_bio, auth.uid())
  returning id into v_id;

  perform public.log_action(v_clan_id, 'MEMBER', v_id, 'CREATE', null);
  return v_id;
end $$;

grant execute on function public.create_member(text, public.gender, date, date, text) to authenticated;

create or replace function public.update_member(
  p_member_id uuid,
  p_full_name text,
  p_gender public.gender,
  p_dob date,
  p_dod date,
  p_bio text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clan_id uuid;
  v_role public.app_role;
  v_gender public.gender;
begin
  select clan_id into v_clan_id from public.members where id = p_member_id;
  if v_clan_id is null then raise exception 'Not found'; end if;
  v_role := public.user_role_in_clan(v_clan_id);
  if v_role not in ('admin','clan_manager') then raise exception 'Forbidden'; end if;

  v_gender := coalesce(p_gender,'UNKNOWN');

  if v_gender <> 'MALE' and exists (
    select 1 from public.member_parent_child where parent_id = p_member_id and parent_role = 'FATHER'
  ) then
    raise exception 'Không thể đổi giới tính vì thành viên này đang được liên kết với vai trò cha';
  end if;

  if v_gender <> 'FEMALE' and exists (
    select 1 from public.member_parent_child where parent_id = p_member_id and parent_role = 'MOTHER'
  ) then
    raise exception 'Không thể đổi giới tính vì thành viên này đang được liên kết với vai trò mẹ';
  end if;

  update public.members
  set full_name = trim(p_full_name),
      gender = v_gender,
      dob = p_dob,
      dod = p_dod,
      bio = p_bio
  where id = p_member_id;

  perform public.log_action(v_clan_id, 'MEMBER', p_member_id, 'UPDATE', null);
end $$;

grant execute on function public.update_member(uuid, text, public.gender, date, date, text) to authenticated;

create or replace function public.delete_member(p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clan_id uuid;
  v_role public.app_role;
begin
  select clan_id into v_clan_id from public.members where id = p_member_id;
  if v_clan_id is null then raise exception 'Not found'; end if;
  v_role := public.user_role_in_clan(v_clan_id);
  if v_role not in ('admin','clan_manager') then raise exception 'Forbidden'; end if;

  delete from public.members where id = p_member_id;
  perform public.log_action(v_clan_id, 'MEMBER', p_member_id, 'DELETE', null);
end $$;

grant execute on function public.delete_member(uuid) to authenticated;

-- Relationships hardening helpers
create or replace function public.required_parent_role_from_gender(p_gender public.gender)
returns public.parent_role
language sql
immutable
set search_path = public
as $$
  select case
    when p_gender = 'MALE' then 'FATHER'::public.parent_role
    when p_gender = 'FEMALE' then 'MOTHER'::public.parent_role
    else 'PARENT'::public.parent_role
  end;
$$;

grant execute on function public.required_parent_role_from_gender(public.gender) to authenticated;

create or replace function public.member_role_matches_parent_role(p_member_id uuid, p_parent_role public.parent_role)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists(
    select 1
    from public.members m
    where m.id = p_member_id
      and (
        (p_parent_role = 'FATHER' and m.gender = 'MALE')
        or (p_parent_role = 'MOTHER' and m.gender = 'FEMALE')
        or (p_parent_role = 'PARENT')
      )
  );
$$;

grant execute on function public.member_role_matches_parent_role(uuid, public.parent_role) to authenticated;

create or replace function public.member_is_ancestor(p_ancestor_id uuid, p_descendant_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  with recursive descendants as (
    select mpc.child_id
    from public.member_parent_child mpc
    where mpc.parent_id = p_ancestor_id
    union
    select mpc2.child_id
    from public.member_parent_child mpc2
    join descendants d on d.child_id = mpc2.parent_id
  )
  select exists(select 1 from descendants where child_id = p_descendant_id);
$$;

grant execute on function public.member_is_ancestor(uuid, uuid) to authenticated;

create or replace function public.member_parent_count(p_child_id uuid)
returns integer
language sql
stable
set search_path = public
as $$
  select count(*)::integer
  from public.member_parent_child
  where child_id = p_child_id;
$$;

grant execute on function public.member_parent_count(uuid) to authenticated;

create or replace function public.member_has_parent_role(p_child_id uuid, p_parent_role public.parent_role)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists(
    select 1
    from public.member_parent_child
    where child_id = p_child_id
      and parent_role = p_parent_role
  );
$$;

grant execute on function public.member_has_parent_role(uuid, public.parent_role) to authenticated;

create or replace function public.member_spouse_count(p_member_id uuid)
returns integer
language sql
stable
set search_path = public
as $$
  select count(*)::integer
  from public.member_spouses
  where member_a_id = p_member_id or member_b_id = p_member_id;
$$;

grant execute on function public.member_spouse_count(uuid) to authenticated;

create or replace function public.members_share_parent(p_member_a_id uuid, p_member_b_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists(
    select 1
    from public.member_parent_child a
    join public.member_parent_child b
      on a.parent_id = b.parent_id
    where a.child_id = p_member_a_id
      and b.child_id = p_member_b_id
      and a.child_id <> b.child_id
  );
$$;

grant execute on function public.members_share_parent(uuid, uuid) to authenticated;

create or replace function public.add_parent_child_role(p_parent_id uuid, p_child_id uuid, p_parent_role public.parent_role)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clan_id uuid;
  v_role public.app_role;
  v_parent_count integer;
  v_parent_gender public.gender;
begin
  if p_parent_role not in ('FATHER', 'MOTHER') then
    raise exception 'Hãy chọn rõ vai trò cha hoặc mẹ';
  end if;

  if p_parent_id = p_child_id then
    raise exception 'Cha/mẹ và con không thể là cùng một người';
  end if;

  select clan_id, gender into v_clan_id, v_parent_gender from public.members where id = p_parent_id;
  if v_clan_id is null then
    raise exception 'Không tìm thấy thành viên cha/mẹ';
  end if;

  if not exists (select 1 from public.members m where m.id = p_child_id and m.clan_id = v_clan_id) then
    raise exception 'Không tìm thấy thành viên con trong cùng dòng họ';
  end if;

  v_role := public.user_role_in_clan(v_clan_id);
  if v_role not in ('admin','clan_manager') then
    raise exception 'Forbidden';
  end if;

  if p_parent_role = 'FATHER' and v_parent_gender <> 'MALE' then
    raise exception 'Chỉ thành viên nam mới có thể liên kết với vai trò cha';
  end if;

  if p_parent_role = 'MOTHER' and v_parent_gender <> 'FEMALE' then
    raise exception 'Chỉ thành viên nữ mới có thể liên kết với vai trò mẹ';
  end if;

  if exists (
    select 1
    from public.member_parent_child
    where parent_id = p_parent_id
      and child_id = p_child_id
  ) then
    raise exception 'Quan hệ cha/mẹ - con đã tồn tại';
  end if;

  if exists (
    select 1
    from public.member_spouses ms
    where ms.clan_id = v_clan_id
      and ((ms.member_a_id = p_parent_id and ms.member_b_id = p_child_id)
        or (ms.member_a_id = p_child_id and ms.member_b_id = p_parent_id))
  ) then
    raise exception 'Không thể liên kết cha/mẹ - con cho hai người đang là vợ/chồng';
  end if;

  if public.member_is_ancestor(p_parent_id, p_child_id) then
    raise exception 'Không thể liên kết trực tiếp vì người này đã là tổ tiên của thành viên đó';
  end if;

  if public.member_is_ancestor(p_child_id, p_parent_id) then
    raise exception 'Không thể tạo vòng quan hệ tổ tiên - hậu duệ';
  end if;

  if public.member_has_parent_role(p_child_id, p_parent_role) then
    if p_parent_role = 'FATHER' then
      raise exception 'Thành viên này đã có cha';
    else
      raise exception 'Thành viên này đã có mẹ';
    end if;
  end if;

  v_parent_count := public.member_parent_count(p_child_id);
  if v_parent_count >= 2 then
    raise exception 'Mỗi thành viên chỉ được liên kết tối đa 1 cha và 1 mẹ';
  end if;

  insert into public.member_parent_child(clan_id, parent_id, child_id, parent_role, created_by)
  values (v_clan_id, p_parent_id, p_child_id, p_parent_role, auth.uid());

  perform public.log_action(
    v_clan_id,
    'RELATIONSHIP',
    null,
    'ADD_PARENT_CHILD',
    jsonb_build_object('parent_id', p_parent_id, 'child_id', p_child_id, 'parent_role', p_parent_role)
  );
end $$;

grant execute on function public.add_parent_child_role(uuid, uuid, public.parent_role) to authenticated;

create or replace function public.add_parent_child(p_parent_id uuid, p_child_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent_gender public.gender;
  v_parent_role public.parent_role;
begin
  select gender into v_parent_gender from public.members where id = p_parent_id;
  if v_parent_gender is null then
    raise exception 'Không tìm thấy thành viên cha/mẹ';
  end if;

  v_parent_role := public.required_parent_role_from_gender(v_parent_gender);
  if v_parent_role not in ('FATHER', 'MOTHER') then
    raise exception 'Cần cập nhật giới tính Nam/Nữ trước khi liên kết người này làm cha hoặc mẹ';
  end if;

  perform public.add_parent_child_role(p_parent_id, p_child_id, v_parent_role);
end $$;

grant execute on function public.add_parent_child(uuid, uuid) to authenticated;

create or replace function public.remove_parent_child(p_parent_id uuid, p_child_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clan_id uuid;
  v_role public.app_role;
begin
  select clan_id into v_clan_id from public.member_parent_child where parent_id = p_parent_id and child_id = p_child_id;
  if v_clan_id is null then raise exception 'Not found'; end if;

  v_role := public.user_role_in_clan(v_clan_id);
  if v_role not in ('admin','clan_manager') then raise exception 'Forbidden'; end if;

  delete from public.member_parent_child where parent_id = p_parent_id and child_id = p_child_id;
  perform public.log_action(v_clan_id, 'RELATIONSHIP', null, 'REMOVE_PARENT_CHILD', jsonb_build_object('parent_id', p_parent_id, 'child_id', p_child_id));
end $$;

grant execute on function public.remove_parent_child(uuid, uuid) to authenticated;

create or replace function public.add_spouse(p_member_id uuid, p_spouse_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clan_id uuid;
  v_role public.app_role;
  a uuid;
  b uuid;
begin
  if p_member_id = p_spouse_id then
    raise exception 'Không thể tự liên kết vợ/chồng với chính mình';
  end if;

  select clan_id into v_clan_id from public.members where id = p_member_id;
  if v_clan_id is null then
    raise exception 'Không tìm thấy thành viên';
  end if;

  if not exists (select 1 from public.members m where m.id = p_spouse_id and m.clan_id = v_clan_id) then
    raise exception 'Không tìm thấy thành viên còn lại trong cùng dòng họ';
  end if;

  v_role := public.user_role_in_clan(v_clan_id);
  if v_role not in ('admin','clan_manager') then
    raise exception 'Forbidden';
  end if;

  if p_member_id::text < p_spouse_id::text then
    a := p_member_id;
    b := p_spouse_id;
  else
    a := p_spouse_id;
    b := p_member_id;
  end if;

  if exists (
    select 1
    from public.member_spouses
    where member_a_id = a
      and member_b_id = b
  ) then
    raise exception 'Quan hệ vợ/chồng đã tồn tại';
  end if;

  if public.member_spouse_count(p_member_id) > 0 or public.member_spouse_count(p_spouse_id) > 0 then
    raise exception 'Mỗi thành viên chỉ được có một liên kết vợ/chồng hoạt động trong mô hình hiện tại';
  end if;

  if public.member_is_ancestor(p_member_id, p_spouse_id)
     or public.member_is_ancestor(p_spouse_id, p_member_id) then
    raise exception 'Không thể liên kết vợ/chồng giữa hai người có quan hệ tổ tiên - hậu duệ';
  end if;

  if public.members_share_parent(p_member_id, p_spouse_id) then
    raise exception 'Không thể liên kết vợ/chồng giữa hai người cùng cha/mẹ';
  end if;

  insert into public.member_spouses(clan_id, member_a_id, member_b_id, created_by)
  values (v_clan_id, a, b, auth.uid());

  perform public.log_action(v_clan_id, 'RELATIONSHIP', null, 'ADD_SPOUSE', jsonb_build_object('a', a, 'b', b));
end $$;

grant execute on function public.add_spouse(uuid, uuid) to authenticated;

create or replace function public.remove_spouse(p_member_id uuid, p_spouse_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clan_id uuid;
  v_role public.app_role;
  a uuid;
  b uuid;
begin
  if p_member_id::text < p_spouse_id::text then a := p_member_id; b := p_spouse_id; else a := p_spouse_id; b := p_member_id; end if;

  select clan_id into v_clan_id from public.member_spouses where member_a_id = a and member_b_id = b;
  if v_clan_id is null then raise exception 'Not found'; end if;

  v_role := public.user_role_in_clan(v_clan_id);
  if v_role not in ('admin','clan_manager') then raise exception 'Forbidden'; end if;

  delete from public.member_spouses where member_a_id = a and member_b_id = b;
  perform public.log_action(v_clan_id, 'RELATIONSHIP', null, 'REMOVE_SPOUSE', jsonb_build_object('a', a, 'b', b));
end $$;

grant execute on function public.remove_spouse(uuid, uuid) to authenticated;

-- =========================
-- RPC: Events
-- =========================
create or replace function public.create_event(p_title text, p_type public.event_type, p_event_date date, p_member_id uuid, p_note text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clan_id uuid;
  v_role public.app_role;
  v_id uuid;
begin
  v_clan_id := public.current_clan_id();
  if v_clan_id is null then raise exception 'No active clan'; end if;
  v_role := public.user_role_in_clan(v_clan_id);
  if v_role not in ('admin','clan_manager') then raise exception 'Forbidden'; end if;

  if p_member_id is not null and not exists (select 1 from public.members m where m.id = p_member_id and m.clan_id = v_clan_id) then
    raise exception 'Member not in clan';
  end if;

  insert into public.events(clan_id,title,event_type,event_date,member_id,note,created_by)
  values (v_clan_id, trim(p_title), coalesce(p_type,'OTHER'), p_event_date, p_member_id, p_note, auth.uid())
  returning id into v_id;

  perform public.log_action(v_clan_id, 'EVENT', v_id, 'CREATE', null);
  return v_id;
end $$;

grant execute on function public.create_event(text, public.event_type, date, uuid, text) to authenticated;

create or replace function public.update_event(p_event_id uuid, p_title text, p_type public.event_type, p_event_date date, p_member_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clan_id uuid;
  v_role public.app_role;
begin
  select clan_id into v_clan_id from public.events where id = p_event_id;
  if v_clan_id is null then raise exception 'Not found'; end if;
  v_role := public.user_role_in_clan(v_clan_id);
  if v_role not in ('admin','clan_manager') then raise exception 'Forbidden'; end if;

  if p_member_id is not null and not exists (select 1 from public.members m where m.id = p_member_id and m.clan_id = v_clan_id) then
    raise exception 'Member not in clan';
  end if;

  update public.events
  set title = trim(p_title),
      event_type = coalesce(p_type,'OTHER'),
      event_date = p_event_date,
      member_id = p_member_id,
      note = p_note
  where id = p_event_id;

  perform public.log_action(v_clan_id, 'EVENT', p_event_id, 'UPDATE', null);
end $$;

grant execute on function public.update_event(uuid, text, public.event_type, date, uuid, text) to authenticated;

create or replace function public.delete_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clan_id uuid;
  v_role public.app_role;
begin
  select clan_id into v_clan_id from public.events where id = p_event_id;
  if v_clan_id is null then raise exception 'Not found'; end if;
  v_role := public.user_role_in_clan(v_clan_id);
  if v_role not in ('admin','clan_manager') then raise exception 'Forbidden'; end if;

  delete from public.events where id = p_event_id;
  perform public.log_action(v_clan_id, 'EVENT', p_event_id, 'DELETE', null);
end $$;

grant execute on function public.delete_event(uuid) to authenticated;

-- =========================
-- RPC: Documents
-- =========================
create or replace function public.create_document(p_title text, p_description text, p_doc_type text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clan_id uuid;
  v_role public.app_role;
  v_id uuid;
begin
  v_clan_id := public.current_clan_id();
  if v_clan_id is null then raise exception 'No active clan'; end if;
  v_role := public.user_role_in_clan(v_clan_id);
  if v_role not in ('admin','clan_manager') then raise exception 'Forbidden'; end if;

  insert into public.documents(clan_id,title,description,doc_type,created_by)
  values (v_clan_id, trim(p_title), p_description, p_doc_type, auth.uid())
  returning id into v_id;

  perform public.log_action(v_clan_id, 'DOCUMENT', v_id, 'CREATE', null);
  return v_id;
end $$;

grant execute on function public.create_document(text, text, text) to authenticated;

create or replace function public.delete_document(p_document_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clan_id uuid;
  v_role public.app_role;
begin
  select clan_id into v_clan_id from public.documents where id = p_document_id;
  if v_clan_id is null then raise exception 'Not found'; end if;

  v_role := public.user_role_in_clan(v_clan_id);
  if v_role not in ('admin','clan_manager') then raise exception 'Forbidden'; end if;

  delete from public.documents where id = p_document_id;
  perform public.log_action(v_clan_id, 'DOCUMENT', p_document_id, 'DELETE', null);
end $$;

grant execute on function public.delete_document(uuid) to authenticated;

-- =========================
-- RPC: Funds
-- =========================
create or replace function public.create_fund(p_name text, p_description text, p_currency text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clan_id uuid;
  v_role public.app_role;
  v_id uuid;
begin
  v_clan_id := public.current_clan_id();
  if v_clan_id is null then raise exception 'No active clan'; end if;

  v_role := public.user_role_in_clan(v_clan_id);
  if v_role not in ('admin','clan_manager','treasurer') then raise exception 'Forbidden'; end if;

  insert into public.funds(clan_id, name, description, currency, created_by)
  values (v_clan_id, trim(p_name), nullif(trim(coalesce(p_description, '')), ''), upper(trim(coalesce(p_currency, 'VND'))), auth.uid())
  returning id into v_id;

  perform public.log_action(v_clan_id, 'FUND', v_id, 'CREATE', jsonb_build_object('name', trim(p_name)));
  return v_id;
end $$;

grant execute on function public.create_fund(text, text, text) to authenticated;

create or replace function public.update_fund(p_fund_id uuid, p_name text, p_description text, p_currency text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clan_id uuid;
  v_role public.app_role;
begin
  select clan_id into v_clan_id from public.funds where id = p_fund_id;
  if v_clan_id is null then raise exception 'Fund not found'; end if;

  v_role := public.user_role_in_clan(v_clan_id);
  if v_role not in ('admin','clan_manager','treasurer') then raise exception 'Forbidden'; end if;

  update public.funds
  set name = trim(p_name),
      description = nullif(trim(coalesce(p_description, '')), ''),
      currency = upper(trim(coalesce(p_currency, 'VND'))),
      updated_at = now()
  where id = p_fund_id;

  perform public.log_action(v_clan_id, 'FUND', p_fund_id, 'UPDATE', jsonb_build_object('name', trim(p_name)));
end $$;

grant execute on function public.update_fund(uuid, text, text, text) to authenticated;

create or replace function public.compute_fund_balance(p_fund_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clan_id uuid;
  v_sum numeric;
begin
  select f.clan_id into v_clan_id from public.funds f where f.id = p_fund_id;
  if v_clan_id is null then raise exception 'Fund not found'; end if;
  if not public.is_clan_member(v_clan_id) then raise exception 'Forbidden'; end if;

  select coalesce(sum(case when v.voucher_type='INCOME' then v.amount else -v.amount end), 0)
  into v_sum
  from public.vouchers v
  where v.fund_id = p_fund_id and v.status = 'APPROVED';

  return v_sum;
end $$;

grant execute on function public.compute_fund_balance(uuid) to authenticated;

-- =========================
-- RPC: Vouchers (create/update/submit/approve/reject/adjustment)
-- =========================
create or replace function public.create_voucher(
  p_fund_id uuid,
  p_category_id uuid,
  p_voucher_type public.voucher_type,
  p_title text,
  p_description text,
  p_amount numeric,
  p_voucher_date date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_clan_id uuid;
  v_role public.app_role;
  v_cat_type public.voucher_type;
begin
  v_clan_id := public.current_clan_id();
  if v_clan_id is null then raise exception 'No active clan'; end if;

  v_role := public.user_role_in_clan(v_clan_id);
  if v_role not in ('admin','clan_manager','treasurer') then raise exception 'Forbidden'; end if;

  if not exists (select 1 from public.funds f where f.id = p_fund_id and f.clan_id = v_clan_id and f.is_active = true) then
    raise exception 'Invalid fund';
  end if;

  if p_category_id is not null then
    select c.voucher_type into v_cat_type from public.categories c where c.id = p_category_id and c.clan_id = v_clan_id;
    if v_cat_type is null then raise exception 'Invalid category'; end if;
    if v_cat_type <> p_voucher_type then raise exception 'Category type mismatch'; end if;
  end if;

  insert into public.vouchers(clan_id,fund_id,category_id,voucher_type,title,description,amount,voucher_date,status,created_by)
  values (v_clan_id,p_fund_id,p_category_id,p_voucher_type,trim(p_title),p_description,p_amount,p_voucher_date,'DRAFT',auth.uid())
  returning id into v_id;

  perform public.log_voucher_action(v_id,'CREATE',null);
  return v_id;
end $$;

grant execute on function public.create_voucher(uuid, uuid, public.voucher_type, text, text, numeric, date) to authenticated;

create or replace function public.update_voucher(
  p_voucher_id uuid,
  p_fund_id uuid,
  p_category_id uuid,
  p_voucher_type public.voucher_type,
  p_title text,
  p_description text,
  p_amount numeric,
  p_voucher_date date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clan_id uuid;
  v_role public.app_role;
  v_status public.voucher_status;
  v_cat_type public.voucher_type;
begin
  select clan_id, status into v_clan_id, v_status from public.vouchers where id = p_voucher_id;
  if v_clan_id is null then raise exception 'Not found'; end if;

  v_role := public.user_role_in_clan(v_clan_id);
  if v_role not in ('admin','clan_manager','treasurer') then raise exception 'Forbidden'; end if;
  if v_status <> 'DRAFT' then raise exception 'Only DRAFT can be updated'; end if;

  if not exists (select 1 from public.funds f where f.id = p_fund_id and f.clan_id = v_clan_id and f.is_active = true) then
    raise exception 'Invalid fund';
  end if;

  if p_category_id is not null then
    select c.voucher_type into v_cat_type from public.categories c where c.id = p_category_id and c.clan_id = v_clan_id;
    if v_cat_type is null then raise exception 'Invalid category'; end if;
    if v_cat_type <> p_voucher_type then raise exception 'Category type mismatch'; end if;
  end if;

  update public.vouchers
  set fund_id=p_fund_id, category_id=p_category_id, voucher_type=p_voucher_type, title=trim(p_title), description=p_description,
      amount=p_amount, voucher_date=p_voucher_date
  where id = p_voucher_id;

  perform public.log_voucher_action(p_voucher_id,'UPDATE',null);
end $$;

grant execute on function public.update_voucher(uuid, uuid, uuid, public.voucher_type, text, text, numeric, date) to authenticated;

create or replace function public.submit_voucher(p_voucher_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clan_id uuid;
  v_role public.app_role;
  v_status public.voucher_status;
begin
  select clan_id, status into v_clan_id, v_status from public.vouchers where id = p_voucher_id;
  if v_clan_id is null then raise exception 'Not found'; end if;

  v_role := public.user_role_in_clan(v_clan_id);
  if v_role not in ('admin','clan_manager','treasurer') then raise exception 'Forbidden'; end if;
  if v_status <> 'DRAFT' then raise exception 'Only DRAFT can be submitted'; end if;

  update public.vouchers set status='PENDING' where id = p_voucher_id;
  perform public.log_voucher_action(p_voucher_id,'SUBMIT',null);
end $$;

grant execute on function public.submit_voucher(uuid) to authenticated;

create or replace function public.approve_voucher(p_voucher_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clan_id uuid;
  v_role public.app_role;
  v_status public.voucher_status;
  v_created_by uuid;
begin
  select clan_id, status, created_by into v_clan_id, v_status, v_created_by from public.vouchers where id = p_voucher_id;
  if v_clan_id is null then raise exception 'Not found'; end if;

  v_role := public.user_role_in_clan(v_clan_id);
  if v_role not in ('admin','approver') then raise exception 'Forbidden'; end if;
  if v_status <> 'PENDING' then raise exception 'Only PENDING can be approved'; end if;
  if v_created_by = auth.uid() then raise exception 'Maker-checker violation: creator cannot approve own voucher'; end if;

  update public.vouchers set status='APPROVED' where id = p_voucher_id;
  perform public.log_voucher_action(p_voucher_id,'APPROVE',null);
end $$;

grant execute on function public.approve_voucher(uuid) to authenticated;

create or replace function public.reject_voucher(p_voucher_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clan_id uuid;
  v_role public.app_role;
  v_status public.voucher_status;
  v_created_by uuid;
begin
  select clan_id, status, created_by into v_clan_id, v_status, v_created_by from public.vouchers where id = p_voucher_id;
  if v_clan_id is null then raise exception 'Not found'; end if;

  v_role := public.user_role_in_clan(v_clan_id);
  if v_role not in ('admin','approver') then raise exception 'Forbidden'; end if;
  if v_status <> 'PENDING' then raise exception 'Only PENDING can be rejected'; end if;
  if p_reason is null or length(trim(p_reason)) < 3 then raise exception 'Reason required'; end if;
  if v_created_by = auth.uid() then raise exception 'Maker-checker violation: creator cannot reject own voucher'; end if;

  update public.vouchers set status='REJECTED' where id = p_voucher_id;
  perform public.log_voucher_action(p_voucher_id,'REJECT',jsonb_build_object('reason', trim(p_reason)));
end $$;

grant execute on function public.reject_voucher(uuid, text) to authenticated;

create or replace function public.create_adjustment_voucher(
  p_original_voucher_id uuid,
  p_amount numeric,
  p_title text,
  p_description text,
  p_voucher_date date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_original record;
  v_role public.app_role;
  v_new_id uuid;
begin
  select * into v_original from public.vouchers where id = p_original_voucher_id;
  if v_original is null then raise exception 'Original voucher not found'; end if;
  if v_original.status <> 'APPROVED' then raise exception 'Only APPROVED voucher can be adjusted'; end if;

  v_role := public.user_role_in_clan(v_original.clan_id);
  if v_role not in ('admin','clan_manager','treasurer') then raise exception 'Forbidden'; end if;

  if p_amount <= 0 then raise exception 'Amount must be positive'; end if;

  insert into public.vouchers(
    clan_id, fund_id, category_id, voucher_type,
    title, description, amount, voucher_date,
    status, created_by, related_voucher_id
  )
  values (
    v_original.clan_id, v_original.fund_id, v_original.category_id, v_original.voucher_type,
    trim(p_title),
    coalesce(p_description, 'Adjustment for ' || v_original.id::text),
    p_amount,
    coalesce(p_voucher_date, current_date),
    'DRAFT',
    auth.uid(),
    v_original.id
  )
  returning id into v_new_id;

  perform public.log_voucher_action(v_new_id,'CREATE_ADJUSTMENT',jsonb_build_object('original_voucher_id', v_original.id));
  return v_new_id;
end $$;

grant execute on function public.create_adjustment_voucher(uuid, numeric, text, text, date) to authenticated;

-- =========================
-- RPC: Attachments (join-table model)
-- =========================
create or replace function public.attach_to_voucher(
  p_voucher_id uuid,
  p_bucket text,
  p_object_path text,
  p_file_name text,
  p_mime_type text,
  p_size_bytes bigint,
  p_checksum text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clan_id uuid;
  v_role public.app_role;
  v_id uuid;
  v_prefix text;
begin
  select clan_id into v_clan_id from public.vouchers where id = p_voucher_id;
  if v_clan_id is null then raise exception 'Not found'; end if;

  v_role := public.user_role_in_clan(v_clan_id);
  if v_role not in ('admin','clan_manager','treasurer') then raise exception 'Forbidden'; end if;

  if p_bucket <> 'clan-files' then raise exception 'Invalid bucket'; end if;

  v_prefix := v_clan_id::text || '/vouchers/' || p_voucher_id::text || '/';
  if left(p_object_path, length(v_prefix)) <> v_prefix then raise exception 'Invalid object path prefix'; end if;

  insert into public.attachments(clan_id,bucket,object_path,file_name,mime_type,size_bytes,checksum,created_by)
  values (v_clan_id,p_bucket,p_object_path,p_file_name,p_mime_type,coalesce(p_size_bytes,0),p_checksum,auth.uid())
  returning id into v_id;

  insert into public.voucher_attachments(clan_id,voucher_id,attachment_id,created_by)
  values (v_clan_id,p_voucher_id,v_id,auth.uid())
  on conflict do nothing;

  perform public.log_voucher_action(p_voucher_id,'ATTACH',jsonb_build_object('file', p_file_name));
  return v_id;
end $$;

grant execute on function public.attach_to_voucher(uuid, text, text, text, text, bigint, text) to authenticated;

create or replace function public.attach_to_document(
  p_document_id uuid,
  p_bucket text,
  p_object_path text,
  p_file_name text,
  p_mime_type text,
  p_size_bytes bigint
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clan_id uuid;
  v_role public.app_role;
  v_id uuid;
  v_prefix text;
begin
  select clan_id into v_clan_id from public.documents where id = p_document_id;
  if v_clan_id is null then raise exception 'Document not found'; end if;

  v_role := public.user_role_in_clan(v_clan_id);
  if v_role not in ('admin','clan_manager') then raise exception 'Forbidden'; end if;

  if p_bucket <> 'clan-files' then raise exception 'Invalid bucket'; end if;

  v_prefix := v_clan_id::text || '/documents/' || p_document_id::text || '/';
  if left(p_object_path, length(v_prefix)) <> v_prefix then raise exception 'Invalid object path prefix'; end if;

  insert into public.attachments(clan_id,bucket,object_path,file_name,mime_type,size_bytes,created_by)
  values (v_clan_id,p_bucket,p_object_path,p_file_name,p_mime_type,coalesce(p_size_bytes,0),auth.uid())
  returning id into v_id;

  insert into public.document_attachments(clan_id,document_id,attachment_id,created_by)
  values (v_clan_id,p_document_id,v_id,auth.uid())
  on conflict do nothing;

  perform public.log_action(v_clan_id, 'ATTACHMENT', v_id, 'ATTACH_DOCUMENT', jsonb_build_object('document_id', p_document_id, 'path', p_object_path));
  return v_id;
end $$;

grant execute on function public.attach_to_document(uuid, text, text, text, text, bigint) to authenticated;

-- =========================
-- RPC: Admin clan members
-- =========================

drop function if exists public.add_clan_member_by_email(text, public.app_role);

create or replace function public.add_clan_member_by_email(p_email text, p_role public.app_role, p_member_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clan_id uuid;
  v_admin_role public.app_role;
  v_user_id uuid;
  v_target_role public.app_role;
begin
  v_clan_id := public.current_clan_id();
  if v_clan_id is null then raise exception 'No active clan'; end if;

  v_admin_role := public.user_role_in_clan(v_clan_id);
  if v_admin_role not in ('admin','clan_manager') then raise exception 'Forbidden'; end if;

  v_target_role := coalesce(p_role,'member');
  if v_admin_role <> 'admin' and v_target_role in ('admin','clan_manager') then
    raise exception 'Only admin can assign admin/clan_manager role';
  end if;

  select id into v_user_id from auth.users where lower(email) = lower(trim(p_email));
  if v_user_id is null then raise exception 'User not found (must register first)'; end if;

  if p_member_id is not null and not exists (
    select 1 from public.members m where m.id = p_member_id and m.clan_id = v_clan_id
  ) then
    raise exception 'Member not in clan';
  end if;

  if p_member_id is not null and exists (
    select 1
    from public.clan_members cm
    where cm.clan_id = v_clan_id
      and cm.member_id = p_member_id
      and cm.user_id <> v_user_id
  ) then
    raise exception 'Member already linked to another account';
  end if;

  if p_member_id is not null then
    perform 1 from public.clan_members cm
    where cm.clan_id = v_clan_id and cm.user_id = v_user_id and cm.member_id is not null and cm.member_id <> p_member_id;
    if found then
      raise exception 'This account is already linked to a different member in this clan';
    end if;

    if public.account_linking_block_reason(v_user_id, v_clan_id, p_member_id) is not null then
      raise exception '%', public.account_linking_block_reason(v_user_id, v_clan_id, p_member_id);
    end if;
  end if;

  insert into public.clan_members(clan_id, user_id, role, member_id)
  values (v_clan_id, v_user_id, v_target_role, p_member_id)
  on conflict (clan_id, user_id) do update
    set role = excluded.role,
        member_id = coalesce(excluded.member_id, public.clan_members.member_id);

  perform public.log_action(v_clan_id, 'CLAN_MEMBER', v_user_id, 'UPSERT_ROLE', jsonb_build_object('role', v_target_role, 'member_id', p_member_id));
end $$;

grant execute on function public.add_clan_member_by_email(text, public.app_role, uuid) to authenticated;

create or replace function public.set_clan_member_role(p_user_id uuid, p_role public.app_role)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clan_id uuid;
  v_admin_role public.app_role;
  v_current_target_role public.app_role;
  v_other_admin_exists boolean;
begin
  v_clan_id := public.current_clan_id();
  if v_clan_id is null then raise exception 'No active clan'; end if;

  v_admin_role := public.user_role_in_clan(v_clan_id);
  if v_admin_role not in ('admin','clan_manager') then raise exception 'Forbidden'; end if;

  select role into v_current_target_role
  from public.clan_members
  where clan_id = v_clan_id and user_id = p_user_id;

  if v_current_target_role is null then raise exception 'Clan member not found'; end if;

  if v_admin_role <> 'admin' and (p_role in ('admin','clan_manager') or v_current_target_role in ('admin','clan_manager')) then
    raise exception 'Only admin can manage admin/clan_manager roles';
  end if;

  if p_user_id = auth.uid() and v_current_target_role = 'admin' and p_role <> 'admin' then
    raise exception 'Admin cannot remove their own admin role';
  end if;

  if v_current_target_role = 'admin' and p_role <> 'admin' then
    select exists(
      select 1
      from public.clan_members cm
      where cm.clan_id = v_clan_id
        and cm.role = 'admin'
        and cm.user_id <> p_user_id
    ) into v_other_admin_exists;

    if not v_other_admin_exists then
      raise exception 'Clan must always keep at least one admin';
    end if;
  end if;

  update public.clan_members set role = p_role
  where clan_id = v_clan_id and user_id = p_user_id;

  perform public.log_action(v_clan_id, 'CLAN_MEMBER', p_user_id, 'SET_ROLE', jsonb_build_object('role', p_role));
end $$;

grant execute on function public.set_clan_member_role(uuid, public.app_role) to authenticated;


-- =========================
-- SIX UPGRADES MVP EXTENSIONS
-- =========================

-- 1) Account ↔ genealogy member link
alter table public.clan_members add column if not exists member_id uuid references public.members(id) on delete set null;
create index if not exists idx_clan_members_member_id on public.clan_members(member_id);
create unique index if not exists uq_clan_members_clan_member_unique_link on public.clan_members(clan_id, member_id) where member_id is not null;


create or replace function public.validate_clan_member_member_link()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_member_clan uuid;
begin
  if new.member_id is null then
    return new;
  end if;

  select clan_id into v_member_clan from public.members where id = new.member_id;
  if v_member_clan is null then
    raise exception 'Linked member not found';
  end if;

  if v_member_clan <> new.clan_id then
    raise exception 'Linked member does not belong to the same clan';
  end if;

  if exists (
    select 1
    from public.clan_members cm
    where cm.clan_id = new.clan_id
      and cm.member_id = new.member_id
      and cm.user_id <> new.user_id
  ) then
    raise exception 'Member already linked to another account';
  end if;

  return new;
end $$;

drop trigger if exists trg_validate_clan_member_member_link on public.clan_members;
create trigger trg_validate_clan_member_member_link
before insert or update on public.clan_members
for each row execute function public.validate_clan_member_member_link();

-- 2) Transparent contributions metadata
alter table public.vouchers add column if not exists member_id uuid references public.members(id) on delete set null;
alter table public.vouchers add column if not exists household_label text;
create index if not exists idx_vouchers_member_id on public.vouchers(member_id);
create index if not exists idx_vouchers_household on public.vouchers(clan_id, household_label);

-- 3) Richer digital archive metadata
alter table public.documents add column if not exists tags text[] not null default '{}';
alter table public.documents add column if not exists member_id uuid references public.members(id) on delete set null;
alter table public.documents add column if not exists event_id uuid references public.events(id) on delete set null;
alter table public.documents add column if not exists visibility text not null default 'CLAN';
create index if not exists idx_documents_member_id on public.documents(member_id);
create index if not exists idx_documents_event_id on public.documents(event_id);

-- 4) Notifications / announcements
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans(id) on delete cascade,
  title text not null,
  body text,
  kind text not null default 'ANNOUNCEMENT',
  event_id uuid references public.events(id) on delete set null,
  scheduled_for date,
  is_pinned boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_clan_created on public.notifications(clan_id, created_at desc);
create index if not exists idx_notifications_clan_scheduled on public.notifications(clan_id, scheduled_for);

-- 5) Member profile update request workflow
create table if not exists public.member_update_requests (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  requested_by uuid not null,
  payload jsonb not null,
  note text,
  status text not null default 'PENDING',
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status in ('PENDING','APPROVED','REJECTED'))
);
create index if not exists idx_member_update_requests_clan_status on public.member_update_requests(clan_id, status, created_at desc);
create index if not exists idx_member_update_requests_requested_by on public.member_update_requests(requested_by);

drop trigger if exists trg_member_update_requests_updated_at on public.member_update_requests;
create trigger trg_member_update_requests_updated_at before update on public.member_update_requests
for each row execute function public.set_updated_at();

create or replace function public.get_auth_context()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with p as (
    select full_name, active_clan_id
    from public.profiles
    where user_id = auth.uid()
  ), cm as (
    select member_id
    from public.clan_members
    where clan_id = (select active_clan_id from p)
      and user_id = auth.uid()
  )
  select jsonb_build_object(
    'active_clan_id', p.active_clan_id,
    'role', public.user_role_in_clan(p.active_clan_id),
    'full_name', p.full_name,
    'linked_member_id', (select member_id from cm limit 1)
  )
  from p
$$;

grant execute on function public.get_auth_context() to authenticated;

create or replace function public.account_linking_block_reason(
  p_user_id uuid,
  p_target_clan_id uuid default null,
  p_target_member_id uuid default null
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_clan_id uuid;
  v_clan_name text;
  v_member_name text;
  v_role public.app_role;
begin
  v_clan_id := coalesce(p_target_clan_id, public.current_clan_id());
  if p_user_id is null or v_clan_id is null then
    return null;
  end if;

  if p_target_member_id is not null and exists (
    select 1
    from public.clan_members cm
    where cm.clan_id = v_clan_id
      and cm.user_id = p_user_id
      and cm.member_id is not null
      and cm.member_id <> p_target_member_id
  ) then
    return 'Tài khoản này đã được gắn với một hồ sơ khác trong dòng họ hiện tại.';
  end if;

  select c.name, m.full_name, cm.role
  into v_clan_name, v_member_name, v_role
  from public.clan_members cm
  join public.clans c on c.id = cm.clan_id
  left join public.members m on m.id = cm.member_id
  where cm.user_id = p_user_id
    and cm.clan_id <> v_clan_id
    and cm.member_id is not null
  order by cm.joined_at desc
  limit 1;

  if v_clan_name is not null then
    return 'Tài khoản này đã gắn với hồ sơ "' || coalesce(v_member_name, 'không rõ') || '" ở dòng họ "' || v_clan_name || '". Hãy gỡ liên kết ở dòng họ đó trước khi gắn hồ sơ tại đây.';
  end if;

  select c.name, cm.role
  into v_clan_name, v_role
  from public.clan_members cm
  join public.clans c on c.id = cm.clan_id
  where cm.user_id = p_user_id
    and cm.clan_id <> v_clan_id
    and cm.role in ('admin','clan_manager','approver','treasurer')
  order by case
    when cm.role in ('admin','clan_manager') then 0
    else 1
  end, cm.joined_at desc
  limit 1;

  if v_clan_name is not null then
    return 'Tài khoản này đang giữ vai trò ' || case v_role
      when 'admin' then 'quản trị viên'
      when 'clan_manager' then 'quản lý dòng họ'
      when 'approver' then 'người duyệt'
      when 'treasurer' then 'thủ quỹ'
      else 'đặc biệt'
    end || ' ở dòng họ "' || v_clan_name || '" nên chưa thể gắn trực tiếp vào hồ sơ thành viên của dòng họ này.';
  end if;

  if p_target_member_id is not null and exists (
    select 1
    from public.clan_invitations ci
    join auth.users au on lower(au.email) = lower(ci.email)
    where au.id = p_user_id
      and ci.clan_id = v_clan_id
      and ci.status = 'PENDING'
      and ci.expires_at >= now()
      and ci.member_id is not null
      and ci.member_id <> p_target_member_id
  ) then
    return 'Tài khoản này đang có lời mời chờ gắn với một hồ sơ khác trong dòng họ hiện tại. Hãy hủy lời mời cũ trước.';
  end if;

  return null;
end $$;

grant execute on function public.account_linking_block_reason(uuid, uuid, uuid) to authenticated;

create or replace function public.email_linking_block_reason(
  p_email text,
  p_target_clan_id uuid default null,
  p_target_member_id uuid default null
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  select id into v_user_id
  from auth.users
  where lower(email) = lower(trim(coalesce(p_email, '')))
  limit 1;

  if v_user_id is null then
    return null;
  end if;

  return public.account_linking_block_reason(v_user_id, coalesce(p_target_clan_id, public.current_clan_id()), p_target_member_id);
end $$;

grant execute on function public.email_linking_block_reason(text, uuid, uuid) to authenticated;

create or replace function public.link_clan_member_to_member(p_user_id uuid, p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clan_id uuid;
  v_admin_role public.app_role;
  v_block_reason text;
begin
  v_clan_id := public.current_clan_id();
  if v_clan_id is null then raise exception 'No active clan'; end if;
  v_admin_role := public.user_role_in_clan(v_clan_id);
  if v_admin_role not in ('admin','clan_manager') then raise exception 'Forbidden'; end if;

  if p_member_id is not null and not exists (
    select 1 from public.members m where m.id = p_member_id and m.clan_id = v_clan_id
  ) then
    raise exception 'Member not in clan';
  end if;

  if p_member_id is not null and exists (
    select 1
    from public.clan_members cm
    where cm.clan_id = v_clan_id
      and cm.member_id = p_member_id
      and cm.user_id <> p_user_id
  ) then
    raise exception 'Member already linked to another account';
  end if;

  if p_member_id is not null and exists (
    select 1
    from public.clan_invitations ci
    join auth.users au on lower(au.email) = lower(ci.email)
    where au.id = p_user_id
      and ci.clan_id = v_clan_id
      and ci.status = 'PENDING'
      and ci.expires_at >= now()
      and ci.member_id is not null
      and ci.member_id <> p_member_id
  ) then
    raise exception 'Tài khoản này đang có lời mời chờ gắn với hồ sơ khác trong dòng họ hiện tại. Hãy hủy lời mời cũ trước.';
  end if;

  v_block_reason := public.account_linking_block_reason(p_user_id, v_clan_id, p_member_id);
  if p_member_id is not null and v_block_reason is not null then
    raise exception '%', v_block_reason;
  end if;

  update public.clan_members
  set member_id = p_member_id
  where clan_id = v_clan_id and user_id = p_user_id;

  if not found then
    raise exception 'Clan member not found';
  end if;

  perform public.log_action(v_clan_id, 'CLAN_MEMBER', p_user_id, 'LINK_MEMBER', jsonb_build_object('member_id', p_member_id));
end $$;

grant execute on function public.link_clan_member_to_member(uuid, uuid) to authenticated;

create or replace function public.get_clan_members_admin()
returns table(
  user_id uuid,
  email text,
  full_name text,
  role public.app_role,
  joined_at timestamptz,
  member_id uuid,
  linked_member_name text,
  link_block_reason text
)
language sql
stable
security definer
set search_path = public
as $$
  select cm.user_id,
         au.email,
         p.full_name,
         cm.role,
         cm.joined_at,
         cm.member_id,
         m.full_name as linked_member_name,
         public.account_linking_block_reason(cm.user_id, cm.clan_id, cm.member_id) as link_block_reason
  from public.clan_members cm
  left join auth.users au on au.id = cm.user_id
  left join public.profiles p on p.user_id = cm.user_id
  left join public.members m on m.id = cm.member_id
  where cm.clan_id = public.current_clan_id()
    and public.user_role_in_clan(public.current_clan_id()) in ('admin','clan_manager')
  order by cm.joined_at desc
$$;

grant execute on function public.get_clan_members_admin() to authenticated;

create or replace function public.get_member_linking_admin()
returns table(
  member_id uuid,
  member_name text,
  gender public.gender,
  dob date,
  linked_user_id uuid,
  linked_email text,
  linked_account_name text,
  linked_role public.app_role,
  pending_invitation_id uuid,
  pending_invitation_email text,
  pending_invitation_role public.app_role,
  pending_invitation_expires_at timestamptz,
  pending_invitation_token text,
  pending_invitation_note text
)
language sql
stable
security definer
set search_path = public
as $$
  select m.id as member_id,
         m.full_name as member_name,
         m.gender,
         m.dob,
         cm.user_id as linked_user_id,
         au.email as linked_email,
         p.full_name as linked_account_name,
         cm.role as linked_role,
         i.id as pending_invitation_id,
         i.email as pending_invitation_email,
         i.role as pending_invitation_role,
         i.expires_at as pending_invitation_expires_at,
         i.token as pending_invitation_token,
         i.note as pending_invitation_note
  from public.members m
  left join public.clan_members cm
    on cm.clan_id = m.clan_id
   and cm.member_id = m.id
  left join auth.users au on au.id = cm.user_id
  left join public.profiles p on p.user_id = cm.user_id
  left join lateral (
    select ci.id,
           ci.email,
           ci.role,
           ci.expires_at,
           ci.token,
           ci.note
    from public.clan_invitations ci
    where ci.clan_id = m.clan_id
      and ci.member_id = m.id
      and ci.status = 'PENDING'
      and ci.expires_at >= now()
    order by ci.created_at desc
    limit 1
  ) i on true
  where m.clan_id = public.current_clan_id()
    and public.user_role_in_clan(public.current_clan_id()) in ('admin','clan_manager')
  order by lower(m.full_name), m.created_at asc
$$;

grant execute on function public.get_member_linking_admin() to authenticated;


create or replace function public.create_clan_invitation(
  p_email text,
  p_role public.app_role default 'member',
  p_member_id uuid default null,
  p_note text default null,
  p_expire_days int default 14
)
returns table(invitation_id uuid, invite_token text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clan_id uuid;
  v_admin_role public.app_role;
  v_target_role public.app_role;
  v_email text;
  v_token text;
  v_invitation_id uuid;
begin
  v_clan_id := public.current_clan_id();
  if v_clan_id is null then raise exception 'No active clan'; end if;

  v_admin_role := public.user_role_in_clan(v_clan_id);
  if v_admin_role not in ('admin','clan_manager') then raise exception 'Forbidden'; end if;

  v_target_role := coalesce(p_role, 'member');
  if v_admin_role <> 'admin' and v_target_role in ('admin','clan_manager') then
    raise exception 'Only admin can invite admin/clan_manager';
  end if;

  v_email := lower(trim(coalesce(p_email, '')));
  if v_email = '' then raise exception 'Email is required'; end if;

  if exists (
    select 1
    from auth.users au
    join public.clan_members cm on cm.user_id = au.id and cm.clan_id = v_clan_id
    where lower(au.email) = v_email
  ) then
    raise exception 'This email is already a member of this clan';
  end if;

  if p_member_id is not null and not exists (
    select 1 from public.members m where m.id = p_member_id and m.clan_id = v_clan_id
  ) then
    raise exception 'Member not in clan';
  end if;

  if p_member_id is not null and exists (
    select 1 from public.clan_members cm where cm.clan_id = v_clan_id and cm.member_id = p_member_id
  ) then
    raise exception 'Member already linked to another account';
  end if;

  if p_member_id is not null and public.email_linking_block_reason(v_email, v_clan_id, p_member_id) is not null then
    raise exception '%', public.email_linking_block_reason(v_email, v_clan_id, p_member_id);
  end if;

  update public.clan_invitations
  set status = 'CANCELLED', updated_at = now()
  where clan_id = v_clan_id
    and status = 'PENDING'
    and (lower(email) = v_email or (p_member_id is not null and member_id = p_member_id));

  v_token := encode(extensions.gen_random_bytes(24), 'hex');

  insert into public.clan_invitations(clan_id, email, role, member_id, token, note, invited_by, expires_at)
  values (
    v_clan_id,
    v_email,
    v_target_role,
    p_member_id,
    v_token,
    nullif(trim(coalesce(p_note, '')), ''),
    auth.uid(),
    now() + make_interval(days => greatest(coalesce(p_expire_days, 14), 1))
  )
  returning id into v_invitation_id;

  perform public.log_action(v_clan_id, 'CLAN_INVITATION', v_invitation_id, 'CREATE', jsonb_build_object('email', v_email, 'role', v_target_role, 'member_id', p_member_id));

  return query select v_invitation_id, v_token;
end $$;

grant execute on function public.create_clan_invitation(text, public.app_role, uuid, text, int) to authenticated;

create or replace function public.preview_clan_invitation(p_token text)
returns table(clan_name text, email text, role public.app_role, member_id uuid, member_name text, expires_at timestamptz, status text, note text)
language sql
stable
security definer
set search_path = public
as $$
  select c.name,
         i.email,
         i.role,
         i.member_id,
         m.full_name,
         i.expires_at,
         case when i.status = 'PENDING' and i.expires_at < now() then 'EXPIRED' else i.status end as status,
         i.note
  from public.clan_invitations i
  join public.clans c on c.id = i.clan_id
  left join public.members m on m.id = i.member_id
  where i.token = p_token
  limit 1
$$;

grant execute on function public.preview_clan_invitation(text) to anon, authenticated;

create or replace function public.cancel_clan_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clan_id uuid;
  v_role public.app_role;
begin
  v_clan_id := public.current_clan_id();
  if v_clan_id is null then raise exception 'No active clan'; end if;
  v_role := public.user_role_in_clan(v_clan_id);
  if v_role not in ('admin','clan_manager') then raise exception 'Forbidden'; end if;

  update public.clan_invitations
  set status = 'CANCELLED', updated_at = now()
  where id = p_invitation_id
    and clan_id = v_clan_id
    and status = 'PENDING';

  if not found then raise exception 'Invitation not found'; end if;

  perform public.log_action(v_clan_id, 'CLAN_INVITATION', p_invitation_id, 'CANCEL', null);
end $$;

grant execute on function public.cancel_clan_invitation(uuid) to authenticated;

create or replace function public.accept_clan_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.clan_invitations%rowtype;
  v_email text;
  v_existing_member_id uuid;
  v_role public.app_role;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  select * into v_invite
  from public.clan_invitations
  where token = p_token
  limit 1;

  if v_invite.id is null then raise exception 'Invitation not found'; end if;
  if v_invite.status <> 'PENDING' then raise exception 'Invitation is no longer valid'; end if;
  if v_invite.expires_at < now() then
    update public.clan_invitations set status = 'EXPIRED', updated_at = now() where id = v_invite.id;
    raise exception 'Invitation has expired';
  end if;

  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  if v_email = '' then raise exception 'Account email not found'; end if;
  if lower(v_invite.email) <> v_email then
    raise exception 'This invitation is bound to a different email address';
  end if;

  if v_invite.member_id is not null and exists (
    select 1
    from public.clan_members cm
    where cm.clan_id = v_invite.clan_id
      and cm.member_id = v_invite.member_id
      and cm.user_id <> auth.uid()
  ) then
    raise exception 'This member profile is already linked to another account';
  end if;

  if v_invite.member_id is not null and public.account_linking_block_reason(auth.uid(), v_invite.clan_id, v_invite.member_id) is not null then
    raise exception '%', public.account_linking_block_reason(auth.uid(), v_invite.clan_id, v_invite.member_id);
  end if;

  select member_id into v_existing_member_id
  from public.clan_members
  where clan_id = v_invite.clan_id and user_id = auth.uid();

  if v_existing_member_id is not null and v_invite.member_id is not null and v_existing_member_id <> v_invite.member_id then
    raise exception 'Your account is already linked to a different member in this clan';
  end if;

  v_role := coalesce(v_invite.role, 'member');

  insert into public.clan_members(clan_id, user_id, role, member_id)
  values (v_invite.clan_id, auth.uid(), v_role, v_invite.member_id)
  on conflict (clan_id, user_id) do update
    set role = excluded.role,
        member_id = coalesce(public.clan_members.member_id, excluded.member_id);

  insert into public.profiles(user_id, active_clan_id)
  values (auth.uid(), v_invite.clan_id)
  on conflict (user_id) do update
    set active_clan_id = excluded.active_clan_id,
        updated_at = now();

  update public.clan_invitations
  set status = 'ACCEPTED',
      accepted_by = auth.uid(),
      accepted_at = now(),
      updated_at = now()
  where id = v_invite.id;

  perform public.log_action(v_invite.clan_id, 'CLAN_INVITATION', v_invite.id, 'ACCEPT', jsonb_build_object('user_id', auth.uid()));
  return v_invite.clan_id;
end $$;

grant execute on function public.accept_clan_invitation(text) to authenticated;

create or replace function public.create_notification(
  p_title text,
  p_body text default null,
  p_kind text default 'ANNOUNCEMENT',
  p_event_id uuid default null,
  p_scheduled_for date default null,
  p_is_pinned boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clan_id uuid;
  v_role public.app_role;
  v_id uuid;
begin
  v_clan_id := public.current_clan_id();
  if v_clan_id is null then raise exception 'No active clan'; end if;
  v_role := public.user_role_in_clan(v_clan_id);
  if v_role not in ('admin','clan_manager') then raise exception 'Forbidden'; end if;

  if p_event_id is not null and not exists (select 1 from public.events e where e.id = p_event_id and e.clan_id = v_clan_id) then
    raise exception 'Event not in clan';
  end if;

  insert into public.notifications(clan_id, title, body, kind, event_id, scheduled_for, is_pinned, created_by)
  values (v_clan_id, trim(p_title), nullif(trim(coalesce(p_body, '')), ''), upper(trim(coalesce(p_kind, 'ANNOUNCEMENT'))), p_event_id, p_scheduled_for, coalesce(p_is_pinned, false), auth.uid())
  returning id into v_id;

  perform public.log_action(v_clan_id, 'NOTIFICATION', v_id, 'CREATE', jsonb_build_object('kind', p_kind));
  return v_id;
end $$;

grant execute on function public.create_notification(text, text, text, uuid, date, boolean) to authenticated;

create or replace function public.create_member_update_request(
  p_member_id uuid,
  p_payload jsonb,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clan_id uuid;
  v_id uuid;
begin
  v_clan_id := public.current_clan_id();
  if v_clan_id is null then raise exception 'No active clan'; end if;
  if not exists (select 1 from public.members m where m.id = p_member_id and m.clan_id = v_clan_id) then
    raise exception 'Member not in clan';
  end if;

  insert into public.member_update_requests(clan_id, member_id, requested_by, payload, note)
  values (v_clan_id, p_member_id, auth.uid(), coalesce(p_payload, '{}'::jsonb), nullif(trim(coalesce(p_note,'')),''))
  returning id into v_id;

  perform public.log_action(v_clan_id, 'MEMBER_UPDATE_REQUEST', v_id, 'CREATE', jsonb_build_object('member_id', p_member_id));
  return v_id;
end $$;

grant execute on function public.create_member_update_request(uuid, jsonb, text) to authenticated;

create or replace function public.review_member_update_request(
  p_request_id uuid,
  p_decision text,
  p_review_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.member_update_requests%rowtype;
  v_role public.app_role;
  v_payload jsonb;
begin
  select * into v_req from public.member_update_requests where id = p_request_id;
  if v_req.id is null then raise exception 'Request not found'; end if;
  v_role := public.user_role_in_clan(v_req.clan_id);
  if v_role not in ('admin','clan_manager') then raise exception 'Forbidden'; end if;
  if v_req.status <> 'PENDING' then raise exception 'Request already reviewed'; end if;

  if upper(trim(coalesce(p_decision,''))) = 'APPROVED' then
    v_payload := coalesce(v_req.payload, '{}'::jsonb);
    update public.members
    set full_name = coalesce(nullif(trim(v_payload->>'full_name'), ''), full_name),
        gender = coalesce((v_payload->>'gender')::public.gender, gender),
        dob = coalesce(nullif(v_payload->>'dob', '')::date, dob),
        dod = coalesce(nullif(v_payload->>'dod', '')::date, dod),
        bio = coalesce(v_payload->>'bio', bio)
    where id = v_req.member_id;

    update public.member_update_requests
    set status = 'APPROVED', reviewed_by = auth.uid(), reviewed_at = now(), review_note = nullif(trim(coalesce(p_review_note,'')), '')
    where id = p_request_id;

    perform public.log_action(v_req.clan_id, 'MEMBER_UPDATE_REQUEST', p_request_id, 'APPROVE', jsonb_build_object('member_id', v_req.member_id));
  elsif upper(trim(coalesce(p_decision,''))) = 'REJECTED' then
    update public.member_update_requests
    set status = 'REJECTED', reviewed_by = auth.uid(), reviewed_at = now(), review_note = nullif(trim(coalesce(p_review_note,'')), '')
    where id = p_request_id;

    perform public.log_action(v_req.clan_id, 'MEMBER_UPDATE_REQUEST', p_request_id, 'REJECT', jsonb_build_object('member_id', v_req.member_id));
  else
    raise exception 'Invalid decision';
  end if;
end $$;

grant execute on function public.review_member_update_request(uuid, text, text) to authenticated;

-- Overload document creation with richer metadata
drop function if exists public.create_document(text, text, text, text[], uuid, uuid, text);
create or replace function public.create_document(
  p_title text,
  p_description text,
  p_doc_type text,
  p_tags text[] default null,
  p_member_id uuid default null,
  p_event_id uuid default null,
  p_visibility text default 'CLAN'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clan_id uuid;
  v_role public.app_role;
  v_id uuid;
begin
  v_clan_id := public.current_clan_id();
  if v_clan_id is null then raise exception 'No active clan'; end if;
  v_role := public.user_role_in_clan(v_clan_id);
  if v_role not in ('admin','clan_manager') then raise exception 'Forbidden'; end if;

  if p_member_id is not null and not exists (select 1 from public.members m where m.id = p_member_id and m.clan_id = v_clan_id) then
    raise exception 'Member not in clan';
  end if;
  if p_event_id is not null and not exists (select 1 from public.events e where e.id = p_event_id and e.clan_id = v_clan_id) then
    raise exception 'Event not in clan';
  end if;

  insert into public.documents(clan_id,title,description,doc_type,tags,member_id,event_id,visibility,created_by)
  values (v_clan_id, trim(p_title), p_description, p_doc_type, coalesce(p_tags, '{}'::text[]), p_member_id, p_event_id, upper(trim(coalesce(p_visibility, 'CLAN'))), auth.uid())
  returning id into v_id;

  perform public.log_action(v_clan_id, 'DOCUMENT', v_id, 'CREATE', jsonb_build_object('member_id', p_member_id, 'event_id', p_event_id));
  return v_id;
end $$;

grant execute on function public.create_document(text, text, text, text[], uuid, uuid, text) to authenticated;

-- Overload voucher creation / update with contribution metadata
drop function if exists public.create_voucher(uuid, uuid, public.voucher_type, text, text, numeric, date, uuid, text);
create or replace function public.create_voucher(
  p_fund_id uuid,
  p_category_id uuid,
  p_voucher_type public.voucher_type,
  p_title text,
  p_description text,
  p_amount numeric,
  p_voucher_date date,
  p_member_id uuid default null,
  p_household_label text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_clan_id uuid;
  v_role public.app_role;
  v_cat_type public.voucher_type;
begin
  v_clan_id := public.current_clan_id();
  if v_clan_id is null then raise exception 'No active clan'; end if;

  v_role := public.user_role_in_clan(v_clan_id);
  if v_role not in ('admin','clan_manager','treasurer') then raise exception 'Forbidden'; end if;

  if not exists (select 1 from public.funds f where f.id = p_fund_id and f.clan_id = v_clan_id and f.is_active = true) then
    raise exception 'Invalid fund';
  end if;

  if p_member_id is not null and not exists (select 1 from public.members m where m.id = p_member_id and m.clan_id = v_clan_id) then
    raise exception 'Member not in clan';
  end if;

  if p_category_id is not null then
    select c.voucher_type into v_cat_type from public.categories c where c.id = p_category_id and c.clan_id = v_clan_id;
    if v_cat_type is null then raise exception 'Invalid category'; end if;
    if v_cat_type <> p_voucher_type then raise exception 'Category type mismatch'; end if;
  end if;

  insert into public.vouchers(clan_id,fund_id,category_id,voucher_type,title,description,amount,voucher_date,status,created_by,member_id,household_label)
  values (v_clan_id,p_fund_id,p_category_id,p_voucher_type,trim(p_title),p_description,p_amount,p_voucher_date,'DRAFT',auth.uid(),p_member_id,nullif(trim(coalesce(p_household_label,'')),''))
  returning id into v_id;

  perform public.log_voucher_action(v_id,'CREATE',jsonb_build_object('member_id', p_member_id, 'household_label', p_household_label));
  return v_id;
end $$;

grant execute on function public.create_voucher(uuid, uuid, public.voucher_type, text, text, numeric, date, uuid, text) to authenticated;

drop function if exists public.update_voucher(uuid, uuid, uuid, public.voucher_type, text, text, numeric, date, uuid, text);
create or replace function public.update_voucher(
  p_voucher_id uuid,
  p_fund_id uuid,
  p_category_id uuid,
  p_voucher_type public.voucher_type,
  p_title text,
  p_description text,
  p_amount numeric,
  p_voucher_date date,
  p_member_id uuid default null,
  p_household_label text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clan_id uuid;
  v_role public.app_role;
  v_status public.voucher_status;
  v_cat_type public.voucher_type;
begin
  select clan_id, status into v_clan_id, v_status from public.vouchers where id = p_voucher_id;
  if v_clan_id is null then raise exception 'Not found'; end if;

  v_role := public.user_role_in_clan(v_clan_id);
  if v_role not in ('admin','clan_manager','treasurer') then raise exception 'Forbidden'; end if;
  if v_status <> 'DRAFT' then raise exception 'Only DRAFT can be updated'; end if;

  if not exists (select 1 from public.funds f where f.id = p_fund_id and f.clan_id = v_clan_id and f.is_active = true) then
    raise exception 'Invalid fund';
  end if;

  if p_member_id is not null and not exists (select 1 from public.members m where m.id = p_member_id and m.clan_id = v_clan_id) then
    raise exception 'Member not in clan';
  end if;

  if p_category_id is not null then
    select c.voucher_type into v_cat_type from public.categories c where c.id = p_category_id and c.clan_id = v_clan_id;
    if v_cat_type is null then raise exception 'Invalid category'; end if;
    if v_cat_type <> p_voucher_type then raise exception 'Category type mismatch'; end if;
  end if;

  update public.vouchers
  set fund_id=p_fund_id, category_id=p_category_id, voucher_type=p_voucher_type, title=trim(p_title), description=p_description,
      amount=p_amount, voucher_date=p_voucher_date, member_id=p_member_id, household_label=nullif(trim(coalesce(p_household_label,'')), '')
  where id = p_voucher_id;

  perform public.log_voucher_action(p_voucher_id,'UPDATE',jsonb_build_object('member_id', p_member_id, 'household_label', p_household_label));
end $$;

grant execute on function public.update_voucher(uuid, uuid, uuid, public.voucher_type, text, text, numeric, date, uuid, text) to authenticated;

-- =========================
-- COMPLETE VERSION: clan switcher + stronger account/profile onboarding
-- =========================
create or replace function public.list_my_clans()
returns table(clan_id uuid, clan_name text, role public.app_role, is_active boolean)
language sql
stable
security definer
set search_path = public
as $$
  select cm.clan_id,
         c.name as clan_name,
         cm.role,
         coalesce(p.active_clan_id = cm.clan_id, false) as is_active
  from public.clan_members cm
  join public.clans c on c.id = cm.clan_id
  left join public.profiles p on p.user_id = auth.uid()
  where cm.user_id = auth.uid()
  order by is_active desc, c.name asc
$$;

grant execute on function public.list_my_clans() to authenticated;

create or replace function public.set_active_clan(p_clan_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Bạn chưa đăng nhập'; end if;
  if not exists (select 1 from public.clan_members cm where cm.user_id = auth.uid() and cm.clan_id = p_clan_id) then
    raise exception 'Bạn không thuộc dòng họ này';
  end if;

  insert into public.profiles(user_id, active_clan_id)
  values (auth.uid(), p_clan_id)
  on conflict (user_id) do update
    set active_clan_id = excluded.active_clan_id,
        updated_at = now();
end $$;

grant execute on function public.set_active_clan(uuid) to authenticated;



create or replace function public.upsert_my_profile(
  p_full_name text,
  p_gender public.gender default 'UNKNOWN',
  p_dob date default null,
  p_phone text default null,
  p_hometown text default null,
  p_address text default null,
  p_bio text default null,
  p_avatar_url text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Bạn chưa đăng nhập';
  end if;

  insert into public.profiles (
    user_id,
    full_name,
    gender,
    dob,
    phone,
    hometown,
    address,
    bio,
    avatar_url
  )
  values (
    auth.uid(),
    nullif(trim(coalesce(p_full_name, '')), ''),
    coalesce(p_gender, 'UNKNOWN'),
    p_dob,
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(trim(coalesce(p_hometown, '')), ''),
    nullif(trim(coalesce(p_address, '')), ''),
    nullif(trim(coalesce(p_bio, '')), ''),
    nullif(trim(coalesce(p_avatar_url, '')), '')
  )
  on conflict (user_id) do update set
    full_name = excluded.full_name,
    gender = excluded.gender,
    dob = excluded.dob,
    phone = excluded.phone,
    hometown = excluded.hometown,
    address = excluded.address,
    bio = excluded.bio,
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    updated_at = now();
end;
$$;

grant execute on function public.upsert_my_profile(text, public.gender, date, text, text, text, text, text) to authenticated;
