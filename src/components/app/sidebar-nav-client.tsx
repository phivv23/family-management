"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type SidebarNavItem = { href: string; label: string };
export type SidebarHotItem = { key: string; text: string };

function RedCount({ count }: { count: number }) {
  return (
    <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[11px] font-semibold text-white">
      {count}
    </span>
  );
}

export function SidebarNavClient({
  items,
  badgeEntries,
  hotItems,
}: {
  items: SidebarNavItem[];
  badgeEntries: Array<[string, number]>;
  hotItems: SidebarHotItem[];
}) {
  const pathname = usePathname();
  const onNotificationsPage = pathname?.startsWith("/notifications");
  const badgeMap = new Map(badgeEntries);

  if (onNotificationsPage) {
    badgeMap.set("/notifications", 0);
  }

  const visibleHotItems = onNotificationsPage
    ? hotItems.filter((item) => item.key !== "notifications")
    : hotItems;

  return (
    <>
      {visibleHotItems.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          <div className="font-semibold">Cần chú ý</div>
          <ul className="mt-2 space-y-1">
            {visibleHotItems.map((item) => (
              <li key={item.key} className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-red-600" />
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <nav className="mt-4 flex flex-col gap-1">
        {items.map((it) => {
          const badgeCount = badgeMap.get(it.href) ?? 0;
          return (
            <Link
              key={it.href}
              href={it.href}
              className="flex items-center justify-between rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-amber-50 hover:text-slate-900"
            >
              <span>{it.label}</span>
              {badgeCount > 0 ? <RedCount count={badgeCount} /> : null}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
