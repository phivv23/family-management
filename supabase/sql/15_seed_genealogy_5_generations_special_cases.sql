-- 15_seed_genealogy_5_generations_special_cases.sql
-- Seed demo riêng cho cây gia phả 5 thế hệ có đủ ca: tái hôn, góa, ly hôn, ly thân,
-- con riêng, cha dượng / mẹ kế, con nuôi, thiếu 1 phụ huynh hiện hành.
-- Có thể chạy độc lập sau các file schema/migration.

do $$
declare
  v_clan uuid := '00000000-0000-0000-0000-00000000c1a5'::uuid;
  m uuid;
begin
  if exists(select 1 from public.clans where id = v_clan) then
    return;
  end if;

  insert into public.clans(id, name, description)
  values (
    v_clan,
    'DEMO Nguyễn Tộc 5 đời',
    'Seed gia phả 5 thế hệ: tái hôn, phối ngẫu cũ, con riêng, mẹ kế, cha dượng, con nuôi, ly thân'
  );

  insert into public.members(id, clan_id, full_name, gender, dob, dod, bio) values
    ('00000000-0000-0000-0000-00000000a001', v_clan, 'Cụ Nguyễn Đức Tổ', 'MALE',   '1915-02-10', '1988-01-01', 'Đời 1 - thủy tổ demo'),
    ('00000000-0000-0000-0000-00000000a002', v_clan, 'Cụ bà Trần Thị Tổ', 'FEMALE', '1918-07-03', '1996-01-01', 'Đời 1 - phu nhân demo'),
    ('00000000-0000-0000-0000-00000000a003', v_clan, 'Ông Nguyễn Hữu Minh', 'MALE', '1940-04-12', null, 'Đời 2 - con trưởng, tái hôn sau khi góa vợ'),
    ('00000000-0000-0000-0000-00000000a004', v_clan, 'Bà Nguyễn Thị Lan', 'FEMALE', '1944-09-01', null, 'Đời 2 - con gái của cụ tổ'),
    ('00000000-0000-0000-0000-00000000a005', v_clan, 'Bà Phạm Thị Hòa', 'FEMALE', '1945-06-18', '1978-11-10', 'Đời 2 - vợ đầu của ông Minh, mất sớm'),
    ('00000000-0000-0000-0000-00000000a006', v_clan, 'Bà Lê Thị Mai', 'FEMALE', '1952-03-08', null, 'Đời 2 - vợ sau của ông Minh, có con riêng'),
    ('00000000-0000-0000-0000-00000000a007', v_clan, 'Ông Trần Văn Sơn', 'MALE', '1950-05-20', null, 'Đời 2 - chồng cũ của bà Mai, cha ruột của Trần Quốc Bảo'),
    ('00000000-0000-0000-0000-00000000a008', v_clan, 'Nguyễn Văn Phúc', 'MALE', '1968-02-15', null, 'Đời 3 - con ông Minh và bà Hòa'),
    ('00000000-0000-0000-0000-00000000a009', v_clan, 'Nguyễn Thị Hạnh', 'FEMALE', '1972-10-10', null, 'Đời 3 - con ông Minh và bà Hòa, có giai đoạn ly thân'),
    ('00000000-0000-0000-0000-00000000a00a', v_clan, 'Trần Quốc Bảo', 'MALE', '1978-08-21', null, 'Đời 3 - con riêng của bà Mai, con ruột ông Sơn'),
    ('00000000-0000-0000-0000-00000000a00b', v_clan, 'Nguyễn Văn Khang', 'MALE', '1984-01-30', null, 'Đời 3 - con chung của ông Minh và bà Mai'),
    ('00000000-0000-0000-0000-00000000a00c', v_clan, 'Đỗ Thị Thu', 'FEMALE', '1970-12-05', null, 'Đời 3 - vợ của Nguyễn Văn Phúc'),
    ('00000000-0000-0000-0000-00000000a00d', v_clan, 'Nguyễn Anh Tuấn', 'MALE', '1971-06-09', null, 'Đời 3 - phối ngẫu cũ của Nguyễn Thị Hạnh'),
    ('00000000-0000-0000-0000-00000000a00e', v_clan, 'Nguyễn Đức Anh', 'MALE', '1992-04-04', null, 'Đời 4 - cháu nội của ông Minh'),
    ('00000000-0000-0000-0000-00000000a00f', v_clan, 'Nguyễn Ngọc Linh', 'FEMALE', '1995-09-19', null, 'Đời 4 - cháu nội của ông Minh'),
    ('00000000-0000-0000-0000-00000000a010', v_clan, 'Vũ Hoàng Nam', 'MALE', '2001-05-01', null, 'Đời 4 - con nuôi hợp pháp của vợ chồng Nguyễn Văn Phúc'),
    ('00000000-0000-0000-0000-00000000a011', v_clan, 'Trần Mỹ Duyên', 'FEMALE', '1994-07-12', null, 'Đời 4 - vợ của Nguyễn Đức Anh, có con riêng trước hôn nhân hiện tại'),
    ('00000000-0000-0000-0000-00000000a012', v_clan, 'Lê Văn Nam', 'MALE', '1990-02-11', null, 'Đời 4 - chồng cũ của Trần Mỹ Duyên, cha ruột của Lê Khánh An'),
    ('00000000-0000-0000-0000-00000000a013', v_clan, 'Lê Khánh An', 'FEMALE', '2015-03-16', null, 'Đời 5 - con riêng của Trần Mỹ Duyên, con ruột của Lê Văn Nam'),
    ('00000000-0000-0000-0000-00000000a014', v_clan, 'Nguyễn Gia Bảo', 'MALE', '2018-09-09', null, 'Đời 5 - con chung của Nguyễn Đức Anh và Trần Mỹ Duyên'),
    ('00000000-0000-0000-0000-00000000a016', v_clan, 'Nguyễn Bảo Nhi', 'FEMALE', '2010-12-20', null, 'Đời 4 - con của Nguyễn Thị Hạnh và Nguyễn Anh Tuấn; hiện chỉ theo dõi một nhánh hộ gia đình ly thân')
  on conflict (id) do nothing;

  -- Quan hệ cha mẹ - con
  insert into public.member_parent_child(clan_id, parent_id, child_id, parent_role, child_link_type) values
    (v_clan, '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000a003', 'FATHER', 'BIOLOGICAL'),
    (v_clan, '00000000-0000-0000-0000-00000000a002', '00000000-0000-0000-0000-00000000a003', 'MOTHER', 'BIOLOGICAL'),
    (v_clan, '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000a004', 'FATHER', 'BIOLOGICAL'),
    (v_clan, '00000000-0000-0000-0000-00000000a002', '00000000-0000-0000-0000-00000000a004', 'MOTHER', 'BIOLOGICAL'),

    (v_clan, '00000000-0000-0000-0000-00000000a003', '00000000-0000-0000-0000-00000000a008', 'FATHER', 'BIOLOGICAL'),
    (v_clan, '00000000-0000-0000-0000-00000000a005', '00000000-0000-0000-0000-00000000a008', 'MOTHER', 'BIOLOGICAL'),
    (v_clan, '00000000-0000-0000-0000-00000000a003', '00000000-0000-0000-0000-00000000a009', 'FATHER', 'BIOLOGICAL'),
    (v_clan, '00000000-0000-0000-0000-00000000a005', '00000000-0000-0000-0000-00000000a009', 'MOTHER', 'BIOLOGICAL'),

    (v_clan, '00000000-0000-0000-0000-00000000a007', '00000000-0000-0000-0000-00000000a00a', 'FATHER', 'BIOLOGICAL'),
    (v_clan, '00000000-0000-0000-0000-00000000a006', '00000000-0000-0000-0000-00000000a00a', 'MOTHER', 'BIOLOGICAL'),
    (v_clan, '00000000-0000-0000-0000-00000000a003', '00000000-0000-0000-0000-00000000a00b', 'FATHER', 'BIOLOGICAL'),
    (v_clan, '00000000-0000-0000-0000-00000000a006', '00000000-0000-0000-0000-00000000a00b', 'MOTHER', 'BIOLOGICAL'),

    (v_clan, '00000000-0000-0000-0000-00000000a008', '00000000-0000-0000-0000-00000000a00e', 'FATHER', 'BIOLOGICAL'),
    (v_clan, '00000000-0000-0000-0000-00000000a00c', '00000000-0000-0000-0000-00000000a00e', 'MOTHER', 'BIOLOGICAL'),
    (v_clan, '00000000-0000-0000-0000-00000000a008', '00000000-0000-0000-0000-00000000a00f', 'FATHER', 'BIOLOGICAL'),
    (v_clan, '00000000-0000-0000-0000-00000000a00c', '00000000-0000-0000-0000-00000000a00f', 'MOTHER', 'BIOLOGICAL'),

    (v_clan, '00000000-0000-0000-0000-00000000a008', '00000000-0000-0000-0000-00000000a010', 'FATHER', 'ADOPTED'),
    (v_clan, '00000000-0000-0000-0000-00000000a00c', '00000000-0000-0000-0000-00000000a010', 'MOTHER', 'ADOPTED'),

    (v_clan, '00000000-0000-0000-0000-00000000a012', '00000000-0000-0000-0000-00000000a013', 'FATHER', 'BIOLOGICAL'),
    (v_clan, '00000000-0000-0000-0000-00000000a011', '00000000-0000-0000-0000-00000000a013', 'MOTHER', 'BIOLOGICAL'),
    (v_clan, '00000000-0000-0000-0000-00000000a00e', '00000000-0000-0000-0000-00000000a014', 'FATHER', 'BIOLOGICAL'),
    (v_clan, '00000000-0000-0000-0000-00000000a011', '00000000-0000-0000-0000-00000000a014', 'MOTHER', 'BIOLOGICAL'),

    (v_clan, '00000000-0000-0000-0000-00000000a00d', '00000000-0000-0000-0000-00000000a016', 'FATHER', 'BIOLOGICAL'),
    (v_clan, '00000000-0000-0000-0000-00000000a009', '00000000-0000-0000-0000-00000000a016', 'MOTHER', 'BIOLOGICAL')
  on conflict do nothing;

  -- Hôn phối hiện tại
  insert into public.member_spouses(clan_id, member_a_id, member_b_id) values
    (v_clan, '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000a002'),
    (v_clan, '00000000-0000-0000-0000-00000000a003', '00000000-0000-0000-0000-00000000a006'),
    (v_clan, '00000000-0000-0000-0000-00000000a008', '00000000-0000-0000-0000-00000000a00c'),
    (v_clan, '00000000-0000-0000-0000-00000000a00e', '00000000-0000-0000-0000-00000000a011')
  on conflict do nothing;

  -- Lịch sử / trạng thái hôn phối
  insert into public.member_partner_relationships(
    id, clan_id, member_a_id, member_b_id, relationship_kind, relationship_status, started_on, ended_on, note
  ) values
    ('00000000-0000-0000-0000-00000000b001', v_clan, '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000a002', 'MARRIAGE', 'CURRENT',   '1938-01-01', null,         'Hôn phối đời thứ 1'),
    ('00000000-0000-0000-0000-00000000b002', v_clan, '00000000-0000-0000-0000-00000000a003', '00000000-0000-0000-0000-00000000a005', 'MARRIAGE', 'WIDOWED',   '1966-01-01', '1978-11-10', 'Bà Hòa mất, kết thúc hôn phối'),
    ('00000000-0000-0000-0000-00000000b003', v_clan, '00000000-0000-0000-0000-00000000a003', '00000000-0000-0000-0000-00000000a006', 'MARRIAGE', 'CURRENT',   '1982-02-01', null,         'Ông Minh tái hôn với bà Mai'),
    ('00000000-0000-0000-0000-00000000b004', v_clan, '00000000-0000-0000-0000-00000000a006', '00000000-0000-0000-0000-00000000a007', 'MARRIAGE', 'DIVORCED',  '1976-01-01', '1980-06-01', 'Ly hôn trước khi bà Mai tái hôn'),
    ('00000000-0000-0000-0000-00000000b005', v_clan, '00000000-0000-0000-0000-00000000a008', '00000000-0000-0000-0000-00000000a00c', 'MARRIAGE', 'CURRENT',   '1991-05-15', null,         'Gia đình có 2 con đẻ và 1 con nuôi'),
    ('00000000-0000-0000-0000-00000000b006', v_clan, '00000000-0000-0000-0000-00000000a009', '00000000-0000-0000-0000-00000000a00d', 'MARRIAGE', 'SEPARATED', '2008-03-20', '2012-09-01', 'Ly thân, vẫn là cha mẹ ruột của Nguyễn Bảo Nhi'),
    ('00000000-0000-0000-0000-00000000b007', v_clan, '00000000-0000-0000-0000-00000000a00e', '00000000-0000-0000-0000-00000000a011', 'MARRIAGE', 'CURRENT',   '2017-01-15', null,         'Tạo nhánh blended family đời 4-5'),
    ('00000000-0000-0000-0000-00000000b008', v_clan, '00000000-0000-0000-0000-00000000a011', '00000000-0000-0000-0000-00000000a012', 'MARRIAGE', 'DIVORCED',  '2013-01-01', '2016-02-01', 'Con ruột là Lê Khánh An')
  on conflict (id) do nothing;
end $$;
