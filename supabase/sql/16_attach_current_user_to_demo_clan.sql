-- 16_attach_current_user_to_demo_clan.sql
-- Mục đích:
--   Gắn tài khoản hiện tại của bạn vào clan demo 5 đời đã seed ở file 15,
--   đồng thời đặt clan demo làm active_clan_id.
--
-- Cách dùng:
--   1) Chạy file 14 trước
--   2) Chạy file 15 trước
--   3) Sửa v_user_id bên dưới thành user_id thật của bạn
--   4) Nếu muốn, có thể gán tài khoản vào 1 member demo cụ thể bằng v_member_id
--      (mặc định để null để chỉ vào clan với quyền admin, không link vào nhân vật nào)
--
-- Gợi ý lấy user_id:
--   select user_id, full_name, active_clan_id
--   from public.profiles
--   order by created_at desc;
--
-- Một số member demo sống để bạn có thể link nếu muốn:
--   Ông Nguyễn Hữu Minh : 00000000-0000-0000-0000-00000000a003
--   Nguyễn Văn Phúc     : 00000000-0000-0000-0000-00000000a008
--   Nguyễn Thị Hạnh     : 00000000-0000-0000-0000-00000000a009
--   Nguyễn Đức Anh      : 00000000-0000-0000-0000-00000000a00e

DO $$
DECLARE
  v_clan_id   uuid := '00000000-0000-0000-0000-00000000c1a5'::uuid;
  v_user_id   uuid := 'REPLACE-WITH-YOUR-USER-ID'::uuid;
  v_member_id uuid := null; -- ví dụ: '00000000-0000-0000-0000-00000000a008'::uuid;
BEGIN
  IF v_user_id::text = 'REPLACE-WITH-YOUR-USER-ID' THEN
    RAISE EXCEPTION 'Bạn chưa thay v_user_id bằng user_id thật của mình';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.clans WHERE id = v_clan_id
  ) THEN
    RAISE EXCEPTION 'Chưa có clan demo. Hãy chạy file 15_seed_genealogy_5_generations_special_cases.sql trước';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Không tìm thấy profiles.user_id = %. Hãy đăng nhập/đăng ký tài khoản trước rồi chạy lại', v_user_id;
  END IF;

  IF v_member_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.members m
    WHERE m.id = v_member_id
      AND m.clan_id = v_clan_id
  ) THEN
    RAISE EXCEPTION 'member_id % không thuộc clan demo', v_member_id;
  END IF;

  IF v_member_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.clan_members cm
    WHERE cm.clan_id = v_clan_id
      AND cm.member_id = v_member_id
      AND cm.user_id <> v_user_id
  ) THEN
    RAISE EXCEPTION 'member_id % đã được link với tài khoản khác trong clan demo', v_member_id;
  END IF;

  INSERT INTO public.clan_members(clan_id, user_id, role, member_id)
  VALUES (v_clan_id, v_user_id, 'admin', v_member_id)
  ON CONFLICT (clan_id, user_id)
  DO UPDATE
    SET role = EXCLUDED.role,
        member_id = COALESCE(EXCLUDED.member_id, public.clan_members.member_id);

  UPDATE public.profiles
  SET active_clan_id = v_clan_id,
      updated_at = now()
  WHERE user_id = v_user_id;

  RAISE NOTICE 'Đã gắn user % vào clan demo % với role admin', v_user_id, v_clan_id;
  IF v_member_id IS NOT NULL THEN
    RAISE NOTICE 'Tài khoản đã được link tới member demo %', v_member_id;
  ELSE
    RAISE NOTICE 'Tài khoản chưa link vào member demo nào; chỉ được thêm vào clan với quyền admin';
  END IF;
END $$;
