"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function switchActiveClanAction(formData: FormData) {
  const clanId = String(formData.get("clanId") || "").trim();
  if (!clanId) return;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_active_clan", { p_clan_id: clanId });
  if (error) {
    redirect(`/dashboard?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath("/");
  redirect("/dashboard");
}
