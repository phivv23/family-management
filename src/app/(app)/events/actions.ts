"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuth, requireRole } from "@/lib/auth/context";
import { createEventSchema, updateEventSchema } from "@/lib/zod/event";

export async function createEventAction(payload: unknown) {
  const parsed = createEventSchema.safeParse(payload);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };

  const ctx = await requireAuth();
  requireRole(ctx, ["admin", "clan_manager"]);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_event", {
    p_title: parsed.data.title,
    p_type: parsed.data.type,
    p_event_date: parsed.data.eventDate,
    p_member_id: parsed.data.memberId ?? null,
    p_note: parsed.data.note ?? null
  });

  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/events");
  revalidatePath("/dashboard");
  return { ok: true as const, id: String(data) };
}

export async function updateEventAction(payload: unknown) {
  const parsed = updateEventSchema.safeParse(payload);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };

  const ctx = await requireAuth();
  requireRole(ctx, ["admin", "clan_manager"]);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("update_event", {
    p_event_id: parsed.data.id,
    p_title: parsed.data.title,
    p_type: parsed.data.type,
    p_event_date: parsed.data.eventDate,
    p_member_id: parsed.data.memberId ?? null,
    p_note: parsed.data.note ?? null
  });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/events");
  revalidatePath(`/events/${parsed.data.id}`);
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function deleteEventAction(eventId: string) {
  const ctx = await requireAuth();
  requireRole(ctx, ["admin", "clan_manager"]);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("delete_event", { p_event_id: eventId });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/events");
  revalidatePath("/dashboard");
  return { ok: true as const };
}
