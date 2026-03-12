-- Tighten account -> member linking across clans.
-- Goal: prevent linking an account that is already linked to another clan profile
-- or currently holds elevated responsibilities in another clan.

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
  order by case when cm.role in ('admin','clan_manager') then 0 else 1 end, cm.joined_at desc
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

  if p_member_id is not null and public.account_linking_block_reason(v_user_id, v_clan_id, p_member_id) is not null then
    raise exception '%', public.account_linking_block_reason(v_user_id, v_clan_id, p_member_id);
  end if;

  insert into public.clan_members(clan_id, user_id, role, member_id)
  values (v_clan_id, v_user_id, v_target_role, p_member_id)
  on conflict (clan_id, user_id) do update
    set role = excluded.role,
        member_id = coalesce(excluded.member_id, public.clan_members.member_id);

  perform public.log_action(v_clan_id, 'CLAN_MEMBER', v_user_id, 'UPSERT_ROLE', jsonb_build_object('role', v_target_role, 'member_id', p_member_id));
end $$;

grant execute on function public.add_clan_member_by_email(text, public.app_role, uuid) to authenticated;

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
