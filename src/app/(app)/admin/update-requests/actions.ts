"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, requireRole } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { reviewMemberUpdateRequestSchema } from "@/lib/zod/member-update-request";

export async function reviewMemberUpdateRequestAction(payload: unknown) {
  const parsed = reviewMemberUpdateRequestSchema.safeParse(payload);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };

  const ctx = await requireAuth();
  requireRole(ctx, ["admin", "clan_manager"]);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("review_member_update_request", {
    p_request_id: parsed.data.requestId,
    p_decision: parsed.data.decision,
    p_review_note: parsed.data.reviewNote ?? null,
  });

  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/admin/update-requests");
  revalidatePath("/me");
  return { ok: true as const };
}
