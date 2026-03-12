"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuth, requireRole } from "@/lib/auth/context";
import {
  addParentChildSchema,
  addPartnerRelationshipSchema,
  closePartnerRelationshipSchema,
  createMemberSchema,
  linkParentChildSchema,
  linkSpouseSchema,
  updateMemberSchema,
} from "@/lib/zod/member";

export async function createMemberAction(payload: unknown) {
  const parsed = createMemberSchema.safeParse(payload);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };

  const ctx = await requireAuth();
  requireRole(ctx, ["admin", "clan_manager"]);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_member", {
    p_full_name: parsed.data.fullName,
    p_gender: parsed.data.gender,
    p_dob: parsed.data.dob ?? null,
    p_dod: parsed.data.dod ?? null,
    p_bio: parsed.data.bio ?? null
  });

  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/members");
  return { ok: true as const, id: String(data) };
}

export async function updateMemberAction(payload: unknown) {
  const parsed = updateMemberSchema.safeParse(payload);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };

  const ctx = await requireAuth();
  requireRole(ctx, ["admin", "clan_manager"]);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("update_member", {
    p_member_id: parsed.data.id,
    p_full_name: parsed.data.fullName,
    p_gender: parsed.data.gender,
    p_dob: parsed.data.dob ?? null,
    p_dod: parsed.data.dod ?? null,
    p_bio: parsed.data.bio ?? null
  });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/members/${parsed.data.id}`);
  return { ok: true as const };
}

export async function deleteMemberAction(memberId: string) {
  const ctx = await requireAuth();
  requireRole(ctx, ["admin", "clan_manager"]);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("delete_member", { p_member_id: memberId });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/members");
  return { ok: true as const };
}

export async function addParentChildAction(payload: unknown) {
  const parsed = addParentChildSchema.safeParse(payload);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };
  const ctx = await requireAuth();
  requireRole(ctx, ["admin", "clan_manager"]);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("add_parent_child_role", {
    p_parent_id: parsed.data.parentId,
    p_child_id: parsed.data.childId,
    p_parent_role: parsed.data.parentRole,
    p_child_link_type: parsed.data.childLinkType,
  });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/members/${parsed.data.parentId}`);
  revalidatePath(`/members/${parsed.data.childId}`);
  revalidatePath("/members/tree");
  return { ok: true as const };
}

export async function removeParentChildAction(payload: unknown) {
  const parsed = linkParentChildSchema.safeParse(payload);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };
  const ctx = await requireAuth();
  requireRole(ctx, ["admin", "clan_manager"]);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("remove_parent_child", { p_parent_id: parsed.data.parentId, p_child_id: parsed.data.childId });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/members/${parsed.data.parentId}`);
  revalidatePath(`/members/${parsed.data.childId}`);
  revalidatePath("/members/tree");
  return { ok: true as const };
}

export async function addSpouseAction(payload: unknown) {
  const parsed = linkSpouseSchema.safeParse(payload);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };
  const ctx = await requireAuth();
  requireRole(ctx, ["admin", "clan_manager"]);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("add_spouse", { p_member_id: parsed.data.memberId, p_spouse_id: parsed.data.spouseId });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/members/${parsed.data.memberId}`);
  revalidatePath(`/members/${parsed.data.spouseId}`);
  revalidatePath("/members/tree");
  return { ok: true as const };
}

export async function addPartnerRelationshipAction(payload: unknown) {
  const parsed = addPartnerRelationshipSchema.safeParse(payload);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };
  const ctx = await requireAuth();
  requireRole(ctx, ["admin", "clan_manager"]);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("add_partner_relationship", {
    p_member_id: parsed.data.memberId,
    p_partner_id: parsed.data.partnerId,
    p_started_on: parsed.data.startedOn ?? null,
    p_note: parsed.data.note ?? null,
    p_relationship_kind: parsed.data.relationshipKind,
  });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/members/${parsed.data.memberId}`);
  revalidatePath(`/members/${parsed.data.partnerId}`);
  revalidatePath("/members/tree");
  return { ok: true as const };
}

export async function closePartnerRelationshipAction(payload: unknown) {
  const parsed = closePartnerRelationshipSchema.safeParse(payload);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };
  const ctx = await requireAuth();
  requireRole(ctx, ["admin", "clan_manager"]);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("close_partner_relationship", {
    p_member_id: parsed.data.memberId,
    p_partner_id: parsed.data.partnerId,
    p_close_status: parsed.data.closeStatus,
    p_ended_on: parsed.data.endedOn ?? null,
    p_note: parsed.data.note ?? null,
  });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/members/${parsed.data.memberId}`);
  revalidatePath(`/members/${parsed.data.partnerId}`);
  revalidatePath("/members/tree");
  return { ok: true as const };
}

export async function removeSpouseAction(payload: unknown) {
  const parsed = linkSpouseSchema.safeParse(payload);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };
  const ctx = await requireAuth();
  requireRole(ctx, ["admin", "clan_manager"]);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("remove_spouse", { p_member_id: parsed.data.memberId, p_spouse_id: parsed.data.spouseId });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/members/${parsed.data.memberId}`);
  revalidatePath(`/members/${parsed.data.spouseId}`);
  revalidatePath("/members/tree");
  return { ok: true as const };
}
