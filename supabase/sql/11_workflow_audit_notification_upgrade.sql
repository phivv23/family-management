-- 11_workflow_audit_notification_upgrade.sql
-- Chuẩn hóa thêm lớp thông báo hệ thống cho quy trình phiếu, lời mời và liên kết hồ sơ.
-- Không xóa dữ liệu cũ. Chỉ thêm helper + thay thế một số RPC hiện có.

create or replace function public.create_system_notification(
  p_clan_id uuid,
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
  v_id uuid;
begin
  if p_clan_id is null then
    raise exception 'Clan is required';
  end if;

  insert into public.notifications(clan_id, title, body, kind, event_id, scheduled_for, is_pinned, created_by)
  values (p_clan_id, trim(p_title), nullif(trim(coalesce(p_body, '')), ''), trim(coalesce(p_kind, 'ANNOUNCEMENT')), p_event_id, p_scheduled_for, coalesce(p_is_pinned, false), auth.uid())
  returning id into v_id;

  return v_id;
end $$;

grant execute on function public.create_system_notification(uuid, text, text, text, uuid, date, boolean) to authenticated;

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
  v_created_by uuid;
  v_title text;
begin
  select clan_id, status, created_by, title into v_clan_id, v_status, v_created_by, v_title from public.vouchers where id = p_voucher_id;
  if v_clan_id is null then raise exception 'Not found'; end if;

  v_role := public.user_role_in_clan(v_clan_id);
  if v_role not in ('admin','clan_manager','treasurer','member') then raise exception 'Forbidden'; end if;
  if v_status not in ('DRAFT','REJECTED') then raise exception 'Only DRAFT or REJECTED can be submitted'; end if;
  if v_role = 'member' and v_created_by <> auth.uid() then raise exception 'Forbidden'; end if;

  update public.vouchers set status='PENDING' where id = p_voucher_id;
  perform public.log_voucher_action(p_voucher_id,'SUBMIT',jsonb_build_object('previous_status', v_status, 'submitted_role', v_role));
  perform public.create_system_notification(
    v_clan_id,
    'Có phiếu mới đang chờ duyệt',
    'Phiếu "' || coalesce(v_title, p_voucher_id::text) || '" đã được gửi sang bước chờ duyệt.',
    'SYSTEM_VOUCHER_SUBMITTED'
  );
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
  v_title text;
begin
  select clan_id, status, created_by, title into v_clan_id, v_status, v_created_by, v_title from public.vouchers where id = p_voucher_id;
  if v_clan_id is null then raise exception 'Not found'; end if;

  v_role := public.user_role_in_clan(v_clan_id);
  if v_role not in ('admin','approver') then raise exception 'Forbidden'; end if;
  if v_status <> 'PENDING' then raise exception 'Only PENDING can be approved'; end if;
  if v_created_by = auth.uid() then raise exception 'Maker-checker violation: creator cannot approve own voucher'; end if;

  update public.vouchers set status='APPROVED' where id = p_voucher_id;
  perform public.log_voucher_action(p_voucher_id,'APPROVE',jsonb_build_object('approved_role', v_role));
  perform public.create_system_notification(
    v_clan_id,
    'Một phiếu đã được duyệt',
    'Phiếu "' || coalesce(v_title, p_voucher_id::text) || '" đã chuyển sang trạng thái đã duyệt.',
    'SYSTEM_VOUCHER_APPROVED'
  );
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
  v_title text;
begin
  select clan_id, status, created_by, title into v_clan_id, v_status, v_created_by, v_title from public.vouchers where id = p_voucher_id;
  if v_clan_id is null then raise exception 'Not found'; end if;

  v_role := public.user_role_in_clan(v_clan_id);
  if v_role not in ('admin','approver') then raise exception 'Forbidden'; end if;
  if v_status <> 'PENDING' then raise exception 'Only PENDING can be rejected'; end if;
  if p_reason is null or length(trim(p_reason)) < 3 then raise exception 'Reason required'; end if;
  if v_created_by = auth.uid() then raise exception 'Maker-checker violation: creator cannot reject own voucher'; end if;

  update public.vouchers set status='REJECTED' where id = p_voucher_id;
  perform public.log_voucher_action(p_voucher_id,'REJECT',jsonb_build_object('reason', trim(p_reason), 'rejected_role', v_role));
  perform public.create_system_notification(
    v_clan_id,
    'Một phiếu đã bị từ chối',
    'Phiếu "' || coalesce(v_title, p_voucher_id::text) || '" bị từ chối. Lý do: ' || trim(p_reason),
    'SYSTEM_VOUCHER_REJECTED'
  );
end $$;

grant execute on function public.reject_voucher(uuid, text) to authenticated;

create or replace function public.link_clan_member_to_member(p_user_id uuid, p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clan_id uuid;
  v_admin_role public.app_role;
  v_member_name text;
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

  update public.clan_members
  set member_id = p_member_id
  where clan_id = v_clan_id and user_id = p_user_id;

  if not found then
    raise exception 'Clan member not found';
  end if;

  select full_name into v_member_name from public.members where id = p_member_id;
  perform public.log_action(v_clan_id, 'CLAN_MEMBER', p_user_id, 'LINK_MEMBER', jsonb_build_object('member_id', p_member_id));
  perform public.create_system_notification(
    v_clan_id,
    'Đã liên kết tài khoản với hồ sơ thành viên',
    case when p_member_id is null then 'Một tài khoản đã được gỡ liên kết khỏi hồ sơ gia phả.' else 'Tài khoản đã được gắn với hồ sơ "' || coalesce(v_member_name, p_member_id::text) || '".' end,
    'SYSTEM_MEMBER_LINKED'
  );
end $$;

grant execute on function public.link_clan_member_to_member(uuid, uuid) to authenticated;

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
  v_member_name text;
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

  select full_name into v_member_name from public.members where id = p_member_id;
  perform public.log_action(v_clan_id, 'CLAN_INVITATION', v_invitation_id, 'CREATE', jsonb_build_object('email', v_email, 'role', v_target_role, 'member_id', p_member_id));
  perform public.create_system_notification(
    v_clan_id,
    'Đã gửi lời mời tham gia',
    'Đã gửi lời mời cho ' || v_email || case when p_member_id is not null then ' để gắn với hồ sơ "' || coalesce(v_member_name, p_member_id::text) || '".' else '.' end,
    'SYSTEM_INVITATION_CREATED'
  );

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
  v_member_name text;
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

  select full_name into v_member_name from public.members where id = v_invite.member_id;
  perform public.log_action(v_invite.clan_id, 'CLAN_INVITATION', v_invite.id, 'ACCEPT', jsonb_build_object('user_id', auth.uid()));
  perform public.create_system_notification(
    v_invite.clan_id,
    'Một lời mời đã được chấp nhận',
    'Tài khoản ' || v_email || ' đã chấp nhận lời mời' || case when v_invite.member_id is not null then ' và gắn vào hồ sơ "' || coalesce(v_member_name, v_invite.member_id::text) || '".' else '.' end,
    'SYSTEM_INVITATION_ACCEPTED'
  );
  return v_invite.clan_id;
end $$;

grant execute on function public.accept_clan_invitation(text) to authenticated;
