"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuth, requireRole } from "@/lib/auth/context";
import { createFundSchema, updateFundSchema } from "@/lib/zod/fund";

export async function createFundAction(payload: unknown) {
  const parsed = createFundSchema.safeParse(payload);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };

  const ctx = await requireAuth();
  requireRole(ctx, ["admin", "clan_manager", "treasurer"]);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_fund", {
    p_name: parsed.data.name,
    p_description: parsed.data.description ?? null,
    p_currency: parsed.data.currency,
  });

  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/funds");
  return { ok: true as const, id: String(data) };
}

export async function updateFundAction(payload: unknown) {
  const parsed = updateFundSchema.safeParse(payload);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };

  const ctx = await requireAuth();
  requireRole(ctx, ["admin", "clan_manager", "treasurer"]);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("update_fund", {
    p_fund_id: parsed.data.id,
    p_name: parsed.data.name,
    p_description: parsed.data.description ?? null,
    p_currency: parsed.data.currency,
  });

  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/funds");
  revalidatePath(`/funds/${parsed.data.id}`);
  return { ok: true as const };
}
