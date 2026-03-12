import type { AppRole } from "@/lib/db/types";
import { Sidebar } from "@/components/app/sidebar";

export function AppShell({
  children,
  role,
  activeClanId,
  userId,
}: {
  children: React.ReactNode;
  role: AppRole;
  activeClanId: string;
  userId: string;
}) {
  return (
    <div className="min-h-dvh flex bg-amber-50/40">
      <Sidebar role={role} activeClanId={activeClanId} userId={userId} />
      <main className="flex-1 bg-slate-50 p-4 md:p-6">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
