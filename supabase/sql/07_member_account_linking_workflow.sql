-- Member <-> account linking workflow hardening
-- Apply on existing databases after 00_schema.sql and 01_rls.sql.

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
