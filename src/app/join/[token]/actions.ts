"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function acceptInvitationAction(token: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("accept_clan_invitation", { p_token: token });
  if (error) {
    return { ok: false as const, error: error.message };
  }

  const { data: userData } = await supabase.auth.getUser();
  const fullName = typeof userData?.user?.user_metadata?.full_name === "string"
    ? userData.user.user_metadata.full_name
    : null;
  if (userData?.user?.id && fullName) {
    await supabase.from("profiles").update({ full_name: fullName }).eq("user_id", userData.user.id);
  }

  redirect("/me?joined=1");
}
