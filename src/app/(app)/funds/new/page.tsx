import { requireAuth, requireRole } from "@/lib/auth/context";
import { FundFormClient } from "./FundFormClient";

export default async function NewFundPage() {
  const ctx = await requireAuth();
  requireRole(ctx, ["admin", "clan_manager", "treasurer"]);
  return <FundFormClient />;
}
