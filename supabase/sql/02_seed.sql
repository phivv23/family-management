-- 02_seed.sql
-- Seed demo data (optional)
-- Note: Because auth.users cannot be seeded from SQL editor, this demo clan is not linked to any real user by default.
-- After you register and onboard, the onboarding RPC will create your own clan + default fund/categories.
-- You can ignore this file safely.

do $$
declare
  v_clan uuid := '00000000-0000-0000-0000-00000000c1a0'::uuid;
  v_fund uuid;
  v_cat_in uuid;
  v_cat_ex uuid;
  v_m1 uuid;
  v_m2 uuid;
  v_m3 uuid;
begin
  -- Guard: only seed if not exists
  if exists(select 1 from public.clans where id = v_clan) then
    return;
  end if;

  insert into public.clans(id, name, description)
  values (v_clan, 'DEMO Clan', 'Demo data (not linked to user)');

  insert into public.funds(clan_id, name, description, currency, is_active)
  values (v_clan, 'Quỹ demo', 'Quỹ cho dữ liệu demo', 'VND', true)
  returning id into v_fund;

  insert into public.categories(clan_id, voucher_type, name) values
    (v_clan, 'INCOME', 'Đóng góp'),
    (v_clan, 'EXPENSE', 'Chi giỗ')
  on conflict do nothing;

  select id into v_cat_in
  from public.categories
  where clan_id = v_clan and voucher_type='INCOME' and name='Đóng góp'
  limit 1;

  select id into v_cat_ex
  from public.categories
  where clan_id = v_clan and voucher_type='EXPENSE' and name='Chi giỗ'
  limit 1;

  insert into public.members(clan_id, full_name, gender, dob, bio)
  values (v_clan, 'Cụ Tổ', 'MALE', '1920-01-01', 'Thủy tổ (demo)')
  returning id into v_m1;

  insert into public.members(clan_id, full_name, gender, dob, bio)
  values (v_clan, 'Bà Tổ', 'FEMALE', '1925-01-01', 'Phu nhân (demo)')
  returning id into v_m2;

  insert into public.members(clan_id, full_name, gender, dob, bio)
  values (v_clan, 'Ông A', 'MALE', '1950-01-01', 'Con trai (demo)')
  returning id into v_m3;

  insert into public.member_spouses(clan_id, member_a_id, member_b_id)
  values (v_clan, least(v_m1,v_m2), greatest(v_m1,v_m2))
  on conflict do nothing;

  insert into public.member_parent_child(clan_id, parent_id, child_id, parent_role)
  values (v_clan, v_m1, v_m3, 'FATHER')
  on conflict do nothing;

  insert into public.events(clan_id, title, event_type, event_date, member_id, note)
  values (v_clan, 'Ngày giỗ Cụ Tổ', 'DEATH_ANNIVERSARY', (current_date + 10), v_m1, 'Demo upcoming');

  insert into public.vouchers(clan_id, fund_id, category_id, voucher_type, title, description, amount, voucher_date, status)
  values
    (v_clan, v_fund, v_cat_in, 'INCOME', 'Đóng góp demo', 'Demo', 1000000, current_date - 5, 'APPROVED'),
    (v_clan, v_fund, v_cat_ex, 'EXPENSE', 'Chi giỗ demo', 'Demo', 200000, current_date - 2, 'APPROVED');

end $$;
