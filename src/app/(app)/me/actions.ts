"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createMemberUpdateRequestSchema } from "@/lib/zod/member-update-request";

export async function createMemberUpdateRequestAction(payload: unknown) {
  const parsed = createMemberUpdateRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };
  }

  const ctx = await requireAuth();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_member_update_request", {
    p_member_id: parsed.data.memberId,
    p_payload: {
      full_name: parsed.data.fullName,
      gender: parsed.data.gender,
      dob: parsed.data.dob ?? null,
      dod: parsed.data.dod ?? null,
      bio: parsed.data.bio ?? null,
    },
    p_note: parsed.data.note ?? null,
  });

  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/me");
  revalidatePath("/admin/update-requests");
  if (ctx.linkedMemberId) revalidatePath(`/members/${ctx.linkedMemberId}`);
  return { ok: true as const, id: String(data) };
}
