import { requireAuth, requireRole } from "@/lib/auth/context";
import { EventForm } from "./EventForm";

export default async function NewEventPage() {
  const ctx = await requireAuth();
  requireRole(ctx, ["admin", "clan_manager"]);
  return <EventForm activeClanId={ctx.activeClanId} />;
}
