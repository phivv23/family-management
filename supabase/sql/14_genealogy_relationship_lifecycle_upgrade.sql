-- 14_genealogy_relationship_lifecycle_upgrade.sql
-- Nâng cấp cây gia phả cho các ca tái hôn / ly hôn / góa / con riêng / con nuôi.
-- Mục tiêu:
-- 1) giữ bảng member_spouses như lớp "vợ/chồng hiện tại" để không phá UI cũ
-- 2) bổ sung bảng lịch sử hôn phối để giải thích rõ tái hôn và phối ngẫu cũ
-- 3) bổ sung loại liên kết cha/mẹ - con để phân biệt con đẻ / con nuôi
-- 4) cha dượng / mẹ kế / con riêng tiếp tục là quan hệ SUY RA từ current spouse + parent_child

do $$ begin
  create type public.child_link_type as enum ('BIOLOGICAL','ADOPTED');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.partner_relationship_status as enum ('CURRENT','DIVORCED','SEPARATED','WIDOWED');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.partner_relationship_kind as enum ('MARRIAGE','PARTNERSHIP');
exception when duplicate_object then null;
end $$;

alter table public.member_parent_child
  add column if not exists child_link_type public.child_link_type not null default 'BIOLOGICAL';

update public.member_parent_child
set child_link_type = 'BIOLOGICAL'
where child_link_type is null;

create table if not exists public.member_partner_relationships (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans(id) on delete cascade,
  member_a_id uuid not null references public.members(id) on delete cascade,
  member_b_id uuid not null references public.members(id) on delete cascade,
  relationship_kind public.partner_relationship_kind not null default 'MARRIAGE',
  relationship_status public.partner_relationship_status not null default 'CURRENT',
  started_on date,
  ended_on date,
  note text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (member_a_id <> member_b_id),
  check (member_a_id::text < member_b_id::text),
  check (
    (relationship_status = 'CURRENT' and ended_on is null)
    or (relationship_status <> 'CURRENT')
  )
);

create index if not exists idx_member_partner_relationships_clan_a
  on public.member_partner_relationships(clan_id, member_a_id, relationship_status, created_at desc);

create index if not exists idx_member_partner_relationships_clan_b
  on public.member_partner_relationships(clan_id, member_b_id, relationship_status, created_at desc);

create index if not exists idx_member_partner_relationships_pair
  on public.member_partner_relationships(member_a_id, member_b_id, relationship_status, created_at desc);

drop trigger if exists trg_member_partner_relationships_updated_at on public.member_partner_relationships;
create trigger trg_member_partner_relationships_updated_at
before update on public.member_partner_relationships
for each row execute function public.set_updated_at();

alter table public.member_partner_relationships enable row level security;

drop policy if exists "member_partner_relationships_select_member" on public.member_partner_relationships;
create policy "member_partner_relationships_select_member" on public.member_partner_relationships
for select using (clan_id = public.current_clan_id() and public.has_active_clan_membership());

insert into public.member_partner_relationships(
  clan_id,
  member_a_id,
  member_b_id,
  relationship_kind,
  relationship_status,
  started_on,
  note,
  created_by,
  created_at,
  updated_at
)
select
  ms.clan_id,
  ms.member_a_id,
  ms.member_b_id,
  'MARRIAGE'::public.partner_relationship_kind,
  'CURRENT'::public.partner_relationship_status,
  null,
  'Backfilled from member_spouses',
  ms.created_by,
  ms.created_at,
  ms.created_at
from public.member_spouses ms
where not exists (
  select 1
  from public.member_partner_relationships mpr
  where mpr.member_a_id = ms.member_a_id
    and mpr.member_b_id = ms.member_b_id
    and mpr.relationship_status = 'CURRENT'
);

create or replace function public.member_has_current_partner(p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.member_partner_relationships mpr
    where (mpr.member_a_id = p_member_id or mpr.member_b_id = p_member_id)
      and mpr.relationship_status = 'CURRENT'
  )
$$;

grant execute on function public.member_has_current_partner(uuid) to authenticated;

create or replace function public.add_parent_child_role(
  p_parent_id uuid,
  p_child_id uuid,
  p_parent_role public.parent_role,
  p_child_link_type public.child_link_type
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clan_id uuid;
  v_child_clan_id uuid;
  v_role public.app_role;
  v_parent_count integer;
  v_parent_gender public.gender;
begin
  if p_parent_role not in ('FATHER', 'MOTHER') then
    raise exception 'Vai trò cha/mẹ phải là FATHER hoặc MOTHER';
  end if;

  if p_child_link_type not in ('BIOLOGICAL', 'ADOPTED') then
    raise exception 'Loại liên kết cha/mẹ-con không hợp lệ';
  end if;

  if p_parent_id = p_child_id then
    raise exception 'Không thể tự liên kết cha/mẹ với chính mình';
  end if;

  select clan_id, gender into v_clan_id, v_parent_gender from public.members where id = p_parent_id;
  if v_clan_id is null then
    raise exception 'Không tìm thấy thành viên cha/mẹ';
  end if;

  select clan_id into v_child_clan_id from public.members where id = p_child_id;
  if v_child_clan_id is null or v_child_clan_id <> v_clan_id then
    raise exception 'Không tìm thấy người con trong cùng dòng họ';
  end if;

  v_role := public.user_role_in_clan(v_clan_id);
  if v_role not in ('admin','clan_manager') then
    raise exception 'Forbidden';
  end if;

  if p_parent_role = 'FATHER' and v_parent_gender <> 'MALE' then
    raise exception 'Chỉ thành viên Nam mới được gắn vai trò cha';
  end if;

  if p_parent_role = 'MOTHER' and v_parent_gender <> 'FEMALE' then
    raise exception 'Chỉ thành viên Nữ mới được gắn vai trò mẹ';
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
    where ((ms.member_a_id = p_parent_id and ms.member_b_id = p_child_id)
        or (ms.member_a_id = p_child_id and ms.member_b_id = p_parent_id))
  ) then
    raise exception 'Không thể vừa là vợ/chồng vừa là cha/mẹ - con';
  end if;

  if public.member_is_ancestor(p_parent_id, p_child_id) then
    raise exception 'Không thể tạo vòng lặp tổ tiên - hậu duệ';
  end if;

  if public.member_is_ancestor(p_child_id, p_parent_id) then
    raise exception 'Không thể liên kết cha/mẹ - con với tổ tiên hiện có';
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

  insert into public.member_parent_child(clan_id, parent_id, child_id, parent_role, child_link_type, created_by)
  values (v_clan_id, p_parent_id, p_child_id, p_parent_role, p_child_link_type, auth.uid());

  perform public.log_action(
    v_clan_id,
    'RELATIONSHIP',
    null,
    'ADD_PARENT_CHILD',
    jsonb_build_object(
      'parent_id', p_parent_id,
      'child_id', p_child_id,
      'parent_role', p_parent_role,
      'child_link_type', p_child_link_type
    )
  );
end $$;

grant execute on function public.add_parent_child_role(uuid, uuid, public.parent_role, public.child_link_type) to authenticated;

create or replace function public.add_parent_child_role(
  p_parent_id uuid,
  p_child_id uuid,
  p_parent_role public.parent_role
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.add_parent_child_role(
    p_parent_id,
    p_child_id,
    p_parent_role,
    'BIOLOGICAL'::public.child_link_type
  );
end $$;

grant execute on function public.add_parent_child_role(uuid, uuid, public.parent_role) to authenticated;

create or replace function public.add_partner_relationship(
  p_member_id uuid,
  p_partner_id uuid,
  p_started_on date default null,
  p_note text default null,
  p_relationship_kind public.partner_relationship_kind default 'MARRIAGE'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clan_id uuid;
  v_role public.app_role;
  a uuid;
  b uuid;
  v_relationship_id uuid;
begin
  if p_member_id = p_partner_id then
    raise exception 'Không thể tự liên kết với chính mình';
  end if;

  select clan_id into v_clan_id from public.members where id = p_member_id;
  if v_clan_id is null then
    raise exception 'Không tìm thấy thành viên';
  end if;

  if not exists (
    select 1 from public.members m
    where m.id = p_partner_id
      and m.clan_id = v_clan_id
  ) then
    raise exception 'Không tìm thấy người còn lại trong cùng dòng họ';
  end if;

  v_role := public.user_role_in_clan(v_clan_id);
  if v_role not in ('admin','clan_manager') then
    raise exception 'Forbidden';
  end if;

  if p_member_id::text < p_partner_id::text then
    a := p_member_id;
    b := p_partner_id;
  else
    a := p_partner_id;
    b := p_member_id;
  end if;

  if exists (
    select 1
    from public.member_partner_relationships mpr
    where mpr.member_a_id = a
      and mpr.member_b_id = b
      and mpr.relationship_status = 'CURRENT'
  ) then
    raise exception 'Quan hệ hiện tại giữa hai người này đã tồn tại';
  end if;

  if public.member_has_current_partner(p_member_id) or public.member_has_current_partner(p_partner_id) then
    raise exception 'Mỗi thành viên chỉ được có một phối ngẫu hiện tại. Hãy kết thúc quan hệ hiện tại trước khi tái hôn.';
  end if;

  if public.member_is_ancestor(p_member_id, p_partner_id)
     or public.member_is_ancestor(p_partner_id, p_member_id) then
    raise exception 'Không thể liên kết phối ngẫu giữa hai người có quan hệ tổ tiên - hậu duệ';
  end if;

  if public.members_share_parent(p_member_id, p_partner_id) then
    raise exception 'Không thể liên kết phối ngẫu giữa hai người cùng cha/mẹ';
  end if;

  insert into public.member_partner_relationships(
    clan_id,
    member_a_id,
    member_b_id,
    relationship_kind,
    relationship_status,
    started_on,
    note,
    created_by
  )
  values (
    v_clan_id,
    a,
    b,
    p_relationship_kind,
    'CURRENT',
    p_started_on,
    nullif(trim(coalesce(p_note, '')), ''),
    auth.uid()
  )
  returning id into v_relationship_id;

  insert into public.member_spouses(clan_id, member_a_id, member_b_id, created_by)
  values (v_clan_id, a, b, auth.uid())
  on conflict do nothing;

  perform public.log_action(
    v_clan_id,
    'RELATIONSHIP',
    null,
    'ADD_PARTNER_RELATIONSHIP',
    jsonb_build_object(
      'relationship_id', v_relationship_id,
      'member_a_id', a,
      'member_b_id', b,
      'relationship_kind', p_relationship_kind,
      'started_on', p_started_on,
      'note', nullif(trim(coalesce(p_note, '')), '')
    )
  );

  return v_relationship_id;
end $$;

grant execute on function public.add_partner_relationship(uuid, uuid, date, text, public.partner_relationship_kind) to authenticated;

create or replace function public.add_spouse(p_member_id uuid, p_spouse_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.add_partner_relationship(
    p_member_id,
    p_spouse_id,
    null,
    null,
    'MARRIAGE'::public.partner_relationship_kind
  );
end $$;

grant execute on function public.add_spouse(uuid, uuid) to authenticated;

create or replace function public.close_partner_relationship(
  p_member_id uuid,
  p_partner_id uuid,
  p_close_status public.partner_relationship_status,
  p_ended_on date default null,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  a uuid;
  b uuid;
  v_clan_id uuid;
  v_role public.app_role;
  v_relationship_id uuid;
  v_existing_note text;
begin
  if p_close_status not in ('DIVORCED','SEPARATED','WIDOWED') then
    raise exception 'Trạng thái kết thúc chỉ được là DIVORCED, SEPARATED hoặc WIDOWED';
  end if;

  if p_member_id::text < p_partner_id::text then
    a := p_member_id;
    b := p_partner_id;
  else
    a := p_partner_id;
    b := p_member_id;
  end if;

  select id, clan_id, note
  into v_relationship_id, v_clan_id, v_existing_note
  from public.member_partner_relationships
  where member_a_id = a
    and member_b_id = b
    and relationship_status = 'CURRENT'
  order by created_at desc
  limit 1;

  if v_relationship_id is null then
    raise exception 'Không tìm thấy quan hệ hiện tại để kết thúc';
  end if;

  v_role := public.user_role_in_clan(v_clan_id);
  if v_role not in ('admin','clan_manager') then
    raise exception 'Forbidden';
  end if;

  update public.member_partner_relationships
  set relationship_status = p_close_status,
      ended_on = coalesce(p_ended_on, current_date),
      note = case
        when nullif(trim(coalesce(p_note, '')), '') is null then v_existing_note
        when nullif(trim(coalesce(v_existing_note, '')), '') is null then trim(p_note)
        else v_existing_note || E'\n' || trim(p_note)
      end
  where id = v_relationship_id;

  delete from public.member_spouses
  where member_a_id = a
    and member_b_id = b;

  perform public.log_action(
    v_clan_id,
    'RELATIONSHIP',
    null,
    'CLOSE_PARTNER_RELATIONSHIP',
    jsonb_build_object(
      'relationship_id', v_relationship_id,
      'member_a_id', a,
      'member_b_id', b,
      'close_status', p_close_status,
      'ended_on', coalesce(p_ended_on, current_date),
      'note', nullif(trim(coalesce(p_note, '')), '')
    )
  );
end $$;

grant execute on function public.close_partner_relationship(uuid, uuid, public.partner_relationship_status, date, text) to authenticated;

create or replace function public.remove_spouse(p_member_id uuid, p_spouse_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  a uuid;
  b uuid;
  v_clan_id uuid;
  v_role public.app_role;
begin
  if p_member_id::text < p_spouse_id::text then
    a := p_member_id;
    b := p_spouse_id;
  else
    a := p_spouse_id;
    b := p_member_id;
  end if;

  select clan_id into v_clan_id
  from public.member_spouses
  where member_a_id = a and member_b_id = b;

  if v_clan_id is null then
    raise exception 'Not found';
  end if;

  v_role := public.user_role_in_clan(v_clan_id);
  if v_role not in ('admin','clan_manager') then
    raise exception 'Forbidden';
  end if;

  delete from public.member_spouses
  where member_a_id = a and member_b_id = b;

  delete from public.member_partner_relationships
  where member_a_id = a
    and member_b_id = b
    and relationship_status = 'CURRENT';

  perform public.log_action(
    v_clan_id,
    'RELATIONSHIP',
    null,
    'REMOVE_SPOUSE_CORRECTION',
    jsonb_build_object('member_a_id', a, 'member_b_id', b)
  );
end $$;

grant execute on function public.remove_spouse(uuid, uuid) to authenticated;
