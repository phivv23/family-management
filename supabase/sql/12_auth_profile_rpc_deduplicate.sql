-- 12_auth_profile_rpc_deduplicate.sql
-- Chạy file này trên DB đang dùng nếu đăng ký báo lỗi
-- "Could not choose the best candidate function between ... upsert_my_profile".

drop function if exists public.upsert_my_profile(text, text, public.gender, date, text, text, text, text);
drop function if exists public.upsert_my_profile(text, public.gender, date, text, text, text, text, text);

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
