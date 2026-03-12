import { AppShell } from "@/components/app/app-shell";
import { requireAuth } from "@/lib/auth/context";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireAuth();
  return <AppShell role={ctx.role} activeClanId={ctx.activeClanId} userId={ctx.userId}>{children}</AppShell>;
}
