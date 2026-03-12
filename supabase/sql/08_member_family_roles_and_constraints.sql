-- 08_member_family_roles_and_constraints.sql
-- Add explicit father/mother roles and strengthen non-overlapping family rules.

do $$ begin
  create type public.parent_role as enum ('FATHER','MOTHER','PARENT');
exception when duplicate_object then null;
end $$;

alter table public.member_parent_child
  add column if not exists parent_role public.parent_role not null default 'PARENT';

update public.member_parent_child mpc
set parent_role = case
  when m.gender = 'MALE' then 'FATHER'::public.parent_role
  when m.gender = 'FEMALE' then 'MOTHER'::public.parent_role
  else 'PARENT'::public.parent_role
end
from public.members m
where m.id = mpc.parent_id
  and (mpc.parent_role is null or mpc.parent_role = 'PARENT');

with ranked as (
  select parent_id, child_id, parent_role,
         row_number() over (partition by child_id, parent_role order by created_at, parent_id) as rn
  from public.member_parent_child
  where parent_role in ('FATHER', 'MOTHER')
)
update public.member_parent_child mpc
set parent_role = 'PARENT'
from ranked r
where mpc.parent_id = r.parent_id
  and mpc.child_id = r.child_id
  and r.rn > 1;

create unique index if not exists uq_member_parent_child_child_father on public.member_parent_child(child_id) where parent_role = 'FATHER';
create unique index if not exists uq_member_parent_child_child_mother on public.member_parent_child(child_id) where parent_role = 'MOTHER';

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
