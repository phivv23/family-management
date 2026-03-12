import { cache } from "react";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerComponentClient } from "@/lib/supabase/server";
import type { AppRole, ProfileRow } from "@/lib/db/types";

export type AuthedContext = {
  userId: string;
  activeClanId: string;
  role: AppRole;
  linkedMemberId: string | null;
  profile: ProfileRow;
};

// get_auth_context() returns jsonb:
// { active_clan_id: uuid|null, role: app_role|null, full_name: text|null }
const AuthCtxSchema = z.object({
  active_clan_id: z.string().uuid().nullable(),
  role: z.enum(["admin", "clan_manager", "treasurer", "approver", "member"]).nullable(),
  full_name: z.string().nullable().optional(),
  linked_member_id: z.string().uuid().nullable().optional(),
});

type AuthCtx = z.infer<typeof AuthCtxSchema>;

export const requireAuth = cache(async (): Promise<AuthedContext> => {
  const supabase = await createSupabaseServerComponentClient();

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) redirect("/login");

  const userId = userData.user.id;

  const { data, error } = await supabase.rpc("get_auth_context");
  if (error) {
    console.error("get_auth_context error:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    redirect("/onboarding?e=get_auth_context");
  }

  const parsed = AuthCtxSchema.safeParse(data);
  if (!parsed.success) {
    console.error("get_auth_context invalid payload:", parsed.error.flatten());
    redirect("/onboarding?e=get_auth_context_payload");
  }

  const ctx: AuthCtx = parsed.data;

  if (!ctx.active_clan_id || !ctx.role) {
    redirect("/onboarding");
  }

  const profile: ProfileRow = {
    user_id: userId,
    full_name: ctx.full_name ?? null,
    avatar_url: null, // DB của bạn không có cột này, nên set null để khớp type
    active_clan_id: ctx.active_clan_id,
  };

  return {
    userId,
    activeClanId: ctx.active_clan_id,
    role: ctx.role,
    linkedMemberId: ctx.linked_member_id ?? null,
    profile,
  };
});

export function requireRole(ctx: AuthedContext, allowed: readonly AppRole[]) {
  if (!allowed.includes(ctx.role)) redirect("/dashboard?error=forbidden");
}
