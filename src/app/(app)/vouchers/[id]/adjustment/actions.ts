"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuth, requireRole } from "@/lib/auth/context";
import { z } from "zod";

const createAdjustmentSchema = z.object({
  originalVoucherId: z.string().uuid(),
  amount: z.number().positive(),
  title: z.string().min(2).max(200),
  description: z.string().max(2000).optional().nullable(),
  voucherDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

export async function createAdjustmentVoucherAction(payload: unknown) {
  const parsed = createAdjustmentSchema.safeParse(payload);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };

  const ctx = await requireAuth();
  requireRole(ctx, ["admin", "clan_manager", "treasurer"]);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_adjustment_voucher", {
    p_original_voucher_id: parsed.data.originalVoucherId,
    p_amount: parsed.data.amount,
    p_title: parsed.data.title,
    p_description: parsed.data.description ?? null,
    p_voucher_date: parsed.data.voucherDate ? parsed.data.voucherDate : null,
  });

  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/vouchers");
  revalidatePath(`/vouchers/${parsed.data.originalVoucherId}`);
  return { ok: true as const, id: String(data) };
}
