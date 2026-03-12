import { requireAuth, requireRole } from "@/lib/auth/context";
import { createSupabaseServerComponentClient } from "@/lib/supabase/server";
import { VoucherForm } from "./VoucherForm";

export default async function NewVoucherPage() {
  const ctx = await requireAuth();
  requireRole(ctx, ["admin", "clan_manager", "treasurer", "member"]);

  const supabase = await createSupabaseServerComponentClient();
  const linkedMemberName = ctx.linkedMemberId
    ? (
        await supabase
          .from("members")
          .select("full_name")
          .eq("clan_id", ctx.activeClanId)
          .eq("id", ctx.linkedMemberId)
          .maybeSingle()
      ).data?.full_name ?? null
    : null;

  return (
    <div className="max-w-3xl">
      <VoucherForm role={ctx.role} linkedMemberId={ctx.linkedMemberId} linkedMemberName={linkedMemberName} />
    </div>
  );
}
