import type { User } from '@supabase/supabase-js';

export type PendingMemberProfile = {
  fullName: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN';
  dob: string | null;
  bio: string | null;
  phone?: string | null;
  hometown?: string | null;
  address?: string | null;
};

function normalizeGender(value: unknown): PendingMemberProfile['gender'] {
  if (value === 'MALE' || value === 'FEMALE' || value === 'OTHER' || value === 'UNKNOWN') return value;
  return 'UNKNOWN';
}

export function extractPendingMemberProfile(user: Pick<User, 'email' | 'user_metadata'> | null | undefined): PendingMemberProfile | null {
  if (!user) return null;
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const fullNameRaw = (meta.full_name ?? '').toString().trim();
  if (!fullNameRaw) return null;
  return {
    fullName: fullNameRaw,
    gender: normalizeGender(meta.member_gender),
    dob: null,
    bio: null,
  };
}

export async function ensureLinkedMemberFromMetadata(supabase: any): Promise<{ linked: boolean; memberId: string | null }> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) return { linked: false, memberId: null };

  const { data: profileRow } = await supabase
    .from('profiles')
    .select('full_name,gender,dob,bio')
    .eq('user_id', userData.user.id)
    .maybeSingle();

  const profile = profileRow?.full_name
    ? {
        fullName: String(profileRow.full_name),
        gender: normalizeGender(profileRow.gender),
        dob: typeof profileRow.dob === 'string' ? profileRow.dob : null,
        bio: typeof profileRow.bio === 'string' ? profileRow.bio : null,
      }
    : extractPendingMemberProfile(userData.user);

  if (!profile) return { linked: false, memberId: null };

  const { data: authCtx, error: authErr } = await supabase.rpc('get_auth_context');
  if (authErr || !authCtx?.active_clan_id) return { linked: false, memberId: null };
  if (authCtx?.linked_member_id) return { linked: false, memberId: String(authCtx.linked_member_id) };

  const { data: memberId, error: createErr } = await supabase.rpc('create_member', {
    p_full_name: profile.fullName,
    p_gender: profile.gender,
    p_dob: profile.dob,
    p_dod: null,
    p_bio: profile.bio,
  });
  if (createErr || !memberId) return { linked: false, memberId: null };

  const { error: linkErr } = await supabase.rpc('link_clan_member_to_member', {
    p_user_id: userData.user.id,
    p_member_id: memberId,
  });
  if (linkErr) return { linked: false, memberId: null };

  return { linked: true, memberId: String(memberId) };
}
