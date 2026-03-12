import { requireAuth, requireRole } from "@/lib/auth/context";
import { MemberForm } from "./MemberForm";

export default async function NewMemberPage() {
  const ctx = await requireAuth();
  requireRole(ctx, ["admin", "clan_manager"]);
  return (
    <div className="max-w-2xl">
      <MemberForm />
    </div>
  );
}
