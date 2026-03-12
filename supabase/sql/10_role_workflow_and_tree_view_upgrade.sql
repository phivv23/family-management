-- 10_role_workflow_and_tree_view_upgrade.sql
-- Mở rộng vai trò tài chính cho member theo mô hình đề nghị chi + siết người duyệt độc lập.
-- Đồng thời mở upload chứng từ voucher cho member trên đúng phiếu của mình.

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
  if v_role not in ('admin','clan_manager','treasurer','member') then raise exception 'Forbidden'; end if;
  if v_role = 'member' and p_voucher_type <> 'EXPENSE' then
    raise exception 'Members can only create expense vouchers';
  end if;

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

  perform public.log_voucher_action(v_id,'CREATE',jsonb_build_object('member_id', p_member_id, 'household_label', p_household_label, 'created_role', v_role));
  return v_id;
end $$;

grant execute on function public.create_voucher(uuid, uuid, public.voucher_type, text, text, numeric, date, uuid, text) to authenticated;

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
  v_created_by uuid;
begin
  select clan_id, status, created_by into v_clan_id, v_status, v_created_by from public.vouchers where id = p_voucher_id;
  if v_clan_id is null then raise exception 'Not found'; end if;

  v_role := public.user_role_in_clan(v_clan_id);
  if v_role not in ('admin','clan_manager','treasurer','member') then raise exception 'Forbidden'; end if;
  if v_status not in ('DRAFT','REJECTED') then raise exception 'Only DRAFT or REJECTED can be updated'; end if;
  if v_role = 'member' and v_created_by <> auth.uid() then raise exception 'Forbidden'; end if;
  if v_role = 'member' and p_voucher_type <> 'EXPENSE' then raise exception 'Members can only update expense vouchers'; end if;

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

  perform public.log_voucher_action(p_voucher_id,'UPDATE',jsonb_build_object('member_id', p_member_id, 'household_label', p_household_label, 'updated_from_status', v_status));
end $$;

grant execute on function public.update_voucher(uuid, uuid, uuid, public.voucher_type, text, text, numeric, date, uuid, text) to authenticated;

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
begin
  select clan_id, status, created_by into v_clan_id, v_status, v_created_by from public.vouchers where id = p_voucher_id;
  if v_clan_id is null then raise exception 'Not found'; end if;

  v_role := public.user_role_in_clan(v_clan_id);
  if v_role not in ('admin','clan_manager','treasurer','member') then raise exception 'Forbidden'; end if;
  if v_status not in ('DRAFT','REJECTED') then raise exception 'Only DRAFT or REJECTED can be submitted'; end if;
  if v_role = 'member' and v_created_by <> auth.uid() then raise exception 'Forbidden'; end if;

  update public.vouchers set status='PENDING' where id = p_voucher_id;
  perform public.log_voucher_action(p_voucher_id,'SUBMIT',jsonb_build_object('previous_status', v_status, 'submitted_role', v_role));
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
  perform public.log_voucher_action(p_voucher_id,'APPROVE',jsonb_build_object('approved_role', v_role));
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
  perform public.log_voucher_action(p_voucher_id,'REJECT',jsonb_build_object('reason', trim(p_reason), 'rejected_role', v_role));
end $$;

grant execute on function public.reject_voucher(uuid, text) to authenticated;

create or replace function public.attach_to_voucher(
  p_voucher_id uuid,
  p_bucket text,
  p_object_path text,
  p_file_name text,
  p_mime_type text,
  p_size_bytes bigint,
  p_checksum text default null
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
  v_created_by uuid;
  v_status public.voucher_status;
begin
  select clan_id, created_by, status into v_clan_id, v_created_by, v_status from public.vouchers where id = p_voucher_id;
  if v_clan_id is null then raise exception 'Not found'; end if;

  v_role := public.user_role_in_clan(v_clan_id);
  if v_role not in ('admin','clan_manager','treasurer','member') then raise exception 'Forbidden'; end if;
  if v_role = 'member' and v_created_by <> auth.uid() then raise exception 'Forbidden'; end if;
  if v_role = 'member' and v_status not in ('DRAFT','PENDING','REJECTED') then raise exception 'Member can only attach files to own draft/pending/rejected vouchers'; end if;

  if p_bucket <> 'clan-files' then raise exception 'Invalid bucket'; end if;

  v_prefix := v_clan_id::text || '/vouchers/' || p_voucher_id::text || '/';
  if left(p_object_path, length(v_prefix)) <> v_prefix then raise exception 'Invalid object path prefix'; end if;

  insert into public.attachments(clan_id,bucket,object_path,file_name,mime_type,size_bytes,checksum,created_by)
  values (v_clan_id,p_bucket,p_object_path,p_file_name,p_mime_type,coalesce(p_size_bytes,0),p_checksum,auth.uid())
  returning id into v_id;

  insert into public.voucher_attachments(clan_id,voucher_id,attachment_id,created_by)
  values (v_clan_id,p_voucher_id,v_id,auth.uid())
  on conflict do nothing;

  perform public.log_voucher_action(p_voucher_id,'ATTACH',jsonb_build_object('file', p_file_name, 'attached_role', v_role));
  return v_id;
end $$;

grant execute on function public.attach_to_voucher(uuid, text, text, text, text, bigint, text) to authenticated;
