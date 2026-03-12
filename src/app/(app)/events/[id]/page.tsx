import { requireAuth } from "@/lib/auth/context";
import { EventDetailClient } from "./EventDetailClient";

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAuth();
  const { id } = await params;
  const canManage = ctx.role === "admin" || ctx.role === "clan_manager";
  return <EventDetailClient canManage={canManage} id={id} clanId={ctx.activeClanId} />;
}
