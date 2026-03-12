"use server";

import { z } from "zod";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuth, requireRole } from "@/lib/auth/context";
import {
  addMemberByEmailSchema,
  cancelInvitationSchema,
  createInvitationSchema,
  linkMemberSchema,
  newMemberProfileSchema,
  setRoleSchema,
} from "@/lib/zod/admin";

async function resolveMemberId(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  payload: { linkMode: "none" | "existing" | "create"; memberId?: string | null; newMember?: { fullName: string; gender: "MALE" | "FEMALE" | "OTHER" | "UNKNOWN"; dob?: string | null; bio?: string | null } | null }
) {
  if (payload.linkMode === "existing") return { memberId: payload.memberId ?? null, created: false as const };
  if (payload.linkMode !== "create" || !payload.newMember) return { memberId: null, created: false as const };

  const { data, error } = await supabase.rpc("create_member", {
    p_full_name: payload.newMember.fullName,
    p_gender: payload.newMember.gender,
    p_dob: payload.newMember.dob ?? null,
    p_dod: null,
    p_bio: payload.newMember.bio ?? null,
  });
  if (error) throw new Error(error.message);
  return { memberId: String(data), created: true as const };
}

async function cleanupCreatedMember(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  memberId: string | null,
  created: boolean,
) {
  if (!created || !memberId) return;
  await supabase.rpc("delete_member", { p_member_id: memberId });
}


export async function createAndLinkMemberProfileAction(payload: unknown) {
  const parsed = z.object({
    userId: z.string().uuid(),
    newMember: newMemberProfileSchema,
  }).safeParse(payload);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };

  const ctx = await requireAuth();
  requireRole(ctx, ["admin", "clan_manager"]);

  const supabase = await createSupabaseServerClient();
  const { data: guardErrorData, error: guardRpcError } = await supabase.rpc("account_linking_block_reason", {
    p_user_id: parsed.data.userId,
    p_target_clan_id: ctx.activeClanId,
    p_target_member_id: null,
  });
  if (guardRpcError) return { ok: false as const, error: guardRpcError.message };
  if (guardErrorData) return { ok: false as const, error: String(guardErrorData) };

  const { data: memberId, error: createError } = await supabase.rpc("create_member", {
    p_full_name: parsed.data.newMember.fullName,
    p_gender: parsed.data.newMember.gender,
    p_dob: parsed.data.newMember.dob ?? null,
    p_dod: null,
    p_bio: parsed.data.newMember.bio ?? null,
  });
  if (createError) return { ok: false as const, error: createError.message };

  const memberIdStr = String(memberId);
  const { error: linkError } = await supabase.rpc("link_clan_member_to_member", {
    p_user_id: parsed.data.userId,
    p_member_id: memberIdStr,
  });
  if (linkError) {
    await cleanupCreatedMember(supabase, memberIdStr, true);
    return { ok: false as const, error: linkError.message };
  }

  revalidatePath("/admin/users-roles");
  revalidatePath("/members");
  revalidatePath("/me");
  return { ok: true as const, memberId: String(memberId) };
}

export async function addMemberByEmailAction(payload: unknown) {
  const parsed = addMemberByEmailSchema.safeParse(payload);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };

  const ctx = await requireAuth();
  requireRole(ctx, ["admin", "clan_manager"]);

  if (ctx.role !== "admin" && ["admin", "clan_manager"].includes(parsed.data.role)) {
    return { ok: false as const, error: "Chỉ admin mới được thêm admin hoặc clan_manager." };
  }

  const supabase = await createSupabaseServerClient();

  let memberId: string | null = null;
  let memberCreated = false;
  try {
    const resolved = await resolveMemberId(supabase, parsed.data);
    memberId = resolved.memberId;
    memberCreated = resolved.created;
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Không thể tạo hồ sơ thành viên." };
  }

  const { error } = await supabase.rpc("add_clan_member_by_email", {
    p_email: parsed.data.email,
    p_role: parsed.data.role,
    p_member_id: memberId,
  });

  if (error) {
    await cleanupCreatedMember(supabase, memberId, memberCreated);
    return { ok: false as const, error: error.message };
  }
  revalidatePath("/admin/users-roles");
  revalidatePath("/members");
  if (memberId) revalidatePath(`/members/${memberId}`);
  return { ok: true as const };
}

export async function createClanInvitationAction(payload: unknown) {
  const parsed = createInvitationSchema.safeParse(payload);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };

  const ctx = await requireAuth();
  requireRole(ctx, ["admin", "clan_manager"]);

  if (ctx.role !== "admin" && ["admin", "clan_manager"].includes(parsed.data.role)) {
    return { ok: false as const, error: "Chỉ admin mới được mời vào vai trò admin hoặc clan_manager." };
  }

  const supabase = await createSupabaseServerClient();

  let memberId: string | null = null;
  let memberCreated = false;
  try {
    const resolved = await resolveMemberId(supabase, parsed.data);
    memberId = resolved.memberId;
    memberCreated = resolved.created;
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Không thể tạo hồ sơ thành viên." };
  }

  const { data, error } = await supabase.rpc("create_clan_invitation", {
    p_email: parsed.data.email,
    p_role: parsed.data.role,
    p_member_id: memberId,
    p_note: parsed.data.note ?? null,
    p_expire_days: parsed.data.expireDays,
  });

  if (error) {
    await cleanupCreatedMember(supabase, memberId, memberCreated);
    return { ok: false as const, error: error.message };
  }

  const row = Array.isArray(data) ? data[0] : null;
  revalidatePath("/admin/users-roles");
  revalidatePath("/members");
  if (memberId) revalidatePath(`/members/${memberId}`);
  return {
    ok: true as const,
    invitationId: row?.invitation_id as string | undefined,
    inviteToken: row?.invite_token as string | undefined,
    invitePath: row?.invite_token ? `/join/${row.invite_token}` : undefined,
  };
}

export async function cancelClanInvitationAction(payload: unknown) {
  const parsed = cancelInvitationSchema.safeParse(payload);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };

  const ctx = await requireAuth();
  requireRole(ctx, ["admin", "clan_manager"]);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("cancel_clan_invitation", {
    p_invitation_id: parsed.data.invitationId,
  });

  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/admin/users-roles");
  return { ok: true as const };
}

export async function setMemberRoleAction(payload: unknown) {
  const parsed = setRoleSchema.safeParse(payload);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };

  const ctx = await requireAuth();
  requireRole(ctx, ["admin", "clan_manager"]);

  if (ctx.userId === parsed.data.userId) {
    return { ok: false as const, error: "Hãy dùng tài khoản admin khác nếu cần đổi quyền của chính bạn." };
  }

  if (ctx.role !== "admin" && ["admin", "clan_manager"].includes(parsed.data.role)) {
    return { ok: false as const, error: "Chỉ admin mới được gán admin hoặc clan_manager." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_clan_member_role", {
    p_user_id: parsed.data.userId,
    p_role: parsed.data.role,
  });

  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/admin/users-roles");
  return { ok: true as const };
}

export async function linkClanMemberToMemberAction(payload: unknown) {
  const parsed = linkMemberSchema.safeParse(payload);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };

  const ctx = await requireAuth();
  requireRole(ctx, ["admin", "clan_manager"]);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("link_clan_member_to_member", {
    p_user_id: parsed.data.userId,
    p_member_id: parsed.data.memberId,
  });

  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/admin/users-roles");
  revalidatePath("/me");
  revalidatePath("/members");
  if (parsed.data.memberId) revalidatePath(`/members/${parsed.data.memberId}`);
  return { ok: true as const };
}
