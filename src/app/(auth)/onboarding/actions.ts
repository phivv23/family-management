"use server";

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureLinkedMemberFromMetadata } from "@/lib/member-profile";

const schema = z.object({
  clanName: z.string().trim().min(2).max(120),
});

type Result = { ok: true } | { ok: false; error: string };

export async function createClanAction(formData: FormData): Promise<Result> {
  const parsed = schema.safeParse({ clanName: formData.get("clanName") });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };
  }

  const supabase = await createSupabaseServerClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) return { ok: false, error: "Bạn chưa đăng nhập" };

  const fullNameMeta = userData.user.user_metadata?.full_name;
  const fullName = typeof fullNameMeta === "string" ? fullNameMeta : null;

  const { error } = await supabase.rpc("create_clan_onboarding", {
    clan_name: parsed.data.clanName,
    full_name: fullName,
  });

  if (error) return { ok: false, error: error.message };
  await ensureLinkedMemberFromMetadata(supabase);
  return { ok: true };
}
