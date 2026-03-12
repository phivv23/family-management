"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, requireRole } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createNotificationSchema } from "@/lib/zod/notification";

import { cookies } from "next/headers";
import { systemNotificationSeenCookieName } from "@/lib/notifications/seen";

export async function createNotificationAction(payload: unknown) {
  const parsed = createNotificationSchema.safeParse(payload);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };

  const ctx = await requireAuth();
  requireRole(ctx, ["admin", "clan_manager"]);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("create_notification", {
    p_title: parsed.data.title,
    p_body: parsed.data.body ?? null,
    p_kind: parsed.data.kind,
    p_event_id: parsed.data.eventId ?? null,
    p_scheduled_for: parsed.data.scheduledFor ?? null,
    p_is_pinned: parsed.data.isPinned ?? false,
  });

  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
  return { ok: true as const };
}


export async function markSystemNotificationsSeenAction(clanId: string) {
  const ctx = await requireAuth();
  if (!clanId || clanId !== ctx.activeClanId) return { ok: false as const };

  const store = await cookies();
  store.set(systemNotificationSeenCookieName(clanId), new Date().toISOString(), {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 180,
  });

  revalidatePath("/notifications");
  revalidatePath("/dashboard");
  return { ok: true as const };
}
