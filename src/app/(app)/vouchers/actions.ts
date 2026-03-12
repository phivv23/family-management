"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuth, requireRole } from "@/lib/auth/context";
import { attachToVoucherSchema, createVoucherSchema, rejectVoucherSchema, updateVoucherSchema } from "@/lib/zod/voucher";

export async function createVoucherAction(payload: unknown) {
  const parsed = createVoucherSchema.safeParse(payload);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };

  const ctx = await requireAuth();
  requireRole(ctx, ["treasurer", "admin", "clan_manager", "member"]);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_voucher", {
    p_fund_id: parsed.data.fundId,
    p_category_id: parsed.data.categoryId ?? null,
    p_voucher_type: parsed.data.voucherType,
    p_title: parsed.data.title,
    p_description: parsed.data.description ?? null,
    p_amount: parsed.data.amount,
    p_voucher_date: parsed.data.voucherDate,
    p_member_id: parsed.data.memberId ?? null,
    p_household_label: parsed.data.householdLabel ?? null,
  });

  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/vouchers");
  return { ok: true as const, id: String(data) };
}

export async function updateVoucherAction(payload: unknown) {
  const parsed = updateVoucherSchema.safeParse(payload);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };

  const ctx = await requireAuth();
  requireRole(ctx, ["treasurer", "admin", "clan_manager", "member"]);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("update_voucher", {
    p_voucher_id: parsed.data.id,
    p_fund_id: parsed.data.fundId,
    p_category_id: parsed.data.categoryId ?? null,
    p_voucher_type: parsed.data.voucherType,
    p_title: parsed.data.title,
    p_description: parsed.data.description ?? null,
    p_amount: parsed.data.amount,
    p_voucher_date: parsed.data.voucherDate,
    p_member_id: parsed.data.memberId ?? null,
    p_household_label: parsed.data.householdLabel ?? null,
  });

  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/vouchers/${parsed.data.id}`);
  return { ok: true as const };
}

export async function submitVoucherAction(voucherId: string) {
  const ctx = await requireAuth();
  requireRole(ctx, ["treasurer", "admin", "clan_manager", "member"]);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("submit_voucher", { p_voucher_id: voucherId });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/vouchers/${voucherId}`);
  return { ok: true as const };
}

export async function approveVoucherAction(voucherId: string) {
  const ctx = await requireAuth();
  requireRole(ctx, ["approver", "admin"]);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("approve_voucher", { p_voucher_id: voucherId });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/vouchers/${voucherId}`);
  return { ok: true as const };
}

export async function rejectVoucherAction(payload: unknown) {
  const parsed = rejectVoucherSchema.safeParse(payload);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };

  const ctx = await requireAuth();
  requireRole(ctx, ["approver", "admin"]);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("reject_voucher", { p_voucher_id: parsed.data.id, p_reason: parsed.data.reason });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/vouchers/${parsed.data.id}`);
  return { ok: true as const };
}

export async function attachVoucherAction(payload: unknown) {
  const parsed = attachToVoucherSchema.omit({ checksum: true }).safeParse(payload);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };

  const ctx = await requireAuth();
  requireRole(ctx, ["treasurer", "admin", "clan_manager", "member"]);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("attach_to_voucher", {
    p_voucher_id: parsed.data.voucherId,
    p_bucket: parsed.data.bucket,
    p_object_path: parsed.data.objectPath,
    p_file_name: parsed.data.fileName,
    p_mime_type: parsed.data.mimeType ?? null,
    p_size_bytes: parsed.data.sizeBytes,
    p_checksum: null
  });

  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/vouchers/${parsed.data.voucherId}`);
  return { ok: true as const, attachmentId: String(data) };
}
