import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { AppRole } from "@/lib/db/types";
import { roleLabel } from "@/lib/i18n/labels";
import { createSupabaseServerComponentClient } from "@/lib/supabase/server";
import { switchActiveClanAction } from "@/components/app/actions";
import { roleCanApproveVoucher, roleCanCreateVoucher } from "@/lib/access/role-capabilities";
import { cookies } from "next/headers";
import { normalizeSeenAtCookie, systemNotificationSeenCookieName } from "@/lib/notifications/seen";
import { SidebarNavClient, type SidebarHotItem, type SidebarNavItem } from "./sidebar-nav-client";

type NavItem = { href: string; label: string; roles: AppRole[] };
type ClanRow = { clan_id: string; clan_name: string; role: AppRole; is_active: boolean };

const nav: NavItem[] = [
  { href: "/dashboard", label: "Tổng quan", roles: ["admin", "clan_manager", "treasurer", "approver", "member"] },
  { href: "/me", label: "Hồ sơ của tôi", roles: ["admin", "clan_manager", "treasurer", "approver", "member"] },
  { href: "/notifications", label: "Thông báo", roles: ["admin", "clan_manager", "treasurer", "approver", "member"] },
  { href: "/members", label: "Thành viên", roles: ["admin", "clan_manager", "treasurer", "approver", "member"] },
  { href: "/members/tree", label: "Cây gia phả", roles: ["admin", "clan_manager", "treasurer", "approver", "member"] },
  { href: "/events", label: "Sự kiện", roles: ["admin", "clan_manager", "treasurer", "approver", "member"] },
  { href: "/documents", label: "Tư liệu số", roles: ["admin", "clan_manager", "treasurer", "approver", "member"] },
  { href: "/contributions", label: "Đóng góp", roles: ["admin", "clan_manager", "treasurer", "approver", "member"] },
  { href: "/funds", label: "Các quỹ", roles: ["admin", "clan_manager", "treasurer", "approver"] },
  { href: "/vouchers", label: "Phiếu thu chi", roles: ["admin", "clan_manager", "treasurer", "approver", "member"] },
  { href: "/reports/monthly", label: "Báo cáo", roles: ["admin", "clan_manager", "treasurer", "approver"] },
  { href: "/admin/users-roles", label: "Người dùng & hồ sơ", roles: ["admin", "clan_manager"] },
  { href: "/admin/permissions", label: "Ma trận quyền", roles: ["admin", "clan_manager", "treasurer", "approver"] },
  { href: "/admin/action-logs", label: "Nhật ký thao tác", roles: ["admin", "clan_manager"] },
  { href: "/admin/update-requests", label: "Duyệt cập nhật hồ sơ", roles: ["admin", "clan_manager"] },
];

export async function Sidebar({
  role,
  activeClanId,
  userId,
}: {
  role: AppRole;
  activeClanId: string;
  userId: string;
}) {
  const items = nav.filter((item) => item.roles.includes(role));
  const navItems: SidebarNavItem[] = items.map(({ href, label }) => ({ href, label }));
  const supabase = await createSupabaseServerComponentClient();
  const canManageProfiles = ["admin", "clan_manager"].includes(role);
  const showSystemNotifications = role !== "member";
  const cookieStore = await cookies();
  const seenAt = normalizeSeenAtCookie(cookieStore.get(systemNotificationSeenCookieName(activeClanId))?.value);

  const [
    { data },
    pendingVoucherCountRes,
    myDraftCountRes,
    recentSystemNotificationsRes,
    pendingUpdateReqCountRes,
    pendingInvitationCountRes,
  ] = await Promise.all([
    supabase.rpc("list_my_clans"),
    roleCanApproveVoucher(role)
      ? supabase.from("vouchers").select("id", { head: true, count: "exact" }).eq("clan_id", activeClanId).eq("status", "PENDING")
      : Promise.resolve({ count: 0, data: null, error: null }),
    roleCanCreateVoucher(role)
      ? supabase.from("vouchers").select("id", { head: true, count: "exact" }).eq("clan_id", activeClanId).eq("created_by", userId).eq("status", "DRAFT")
      : Promise.resolve({ count: 0, data: null, error: null }),
    showSystemNotifications
      ? (() => {
          let query = supabase
            .from("notifications")
            .select("id", { head: true, count: "exact" })
            .eq("clan_id", activeClanId)
            .like("kind", "SYSTEM_%");
          if (seenAt) query = query.gt("created_at", seenAt);
          return query;
        })()
      : Promise.resolve({ count: 0, data: null, error: null }),
    canManageProfiles
      ? supabase.from("member_update_requests").select("id", { head: true, count: "exact" }).eq("clan_id", activeClanId).eq("status", "PENDING")
      : Promise.resolve({ count: 0, data: null, error: null }),
    canManageProfiles
      ? supabase.from("clan_invitations").select("id", { head: true, count: "exact" }).eq("clan_id", activeClanId).eq("status", "PENDING")
      : Promise.resolve({ count: 0, data: null, error: null }),
  ]);

  const clans = (((data ?? []) as ClanRow[]) || []).filter((item) => item?.clan_id);
  const activeClan =
    clans.find((item) => item.clan_id === activeClanId) ??
    clans.find((item) => item.is_active) ??
    null;

  const navBadges = new Map<string, number>();
  const pendingVoucherCount = pendingVoucherCountRes.count ?? 0;
  const myDraftCount = myDraftCountRes.count ?? 0;
  const notificationCount = recentSystemNotificationsRes.count ?? 0;
  const pendingUpdateReqCount = pendingUpdateReqCountRes.count ?? 0;
  const pendingInvitationCount = pendingInvitationCountRes.count ?? 0;

  if (roleCanApproveVoucher(role) && pendingVoucherCount > 0) navBadges.set("/vouchers", pendingVoucherCount);
  else if (myDraftCount > 0) navBadges.set("/vouchers", myDraftCount);
  if (showSystemNotifications && notificationCount > 0) navBadges.set("/notifications", notificationCount);
  if (pendingUpdateReqCount > 0) navBadges.set("/admin/update-requests", pendingUpdateReqCount);
  if (pendingInvitationCount > 0) navBadges.set("/admin/users-roles", pendingInvitationCount);

  const hotItems: SidebarHotItem[] = [
    roleCanApproveVoucher(role) && pendingVoucherCount > 0 ? { key: "pending-vouchers", text: `${pendingVoucherCount} phiếu chờ duyệt` } : null,
    canManageProfiles && pendingUpdateReqCount > 0 ? { key: "update-requests", text: `${pendingUpdateReqCount} yêu cầu cập nhật hồ sơ` } : null,
    canManageProfiles && pendingInvitationCount > 0 ? { key: "invitations", text: `${pendingInvitationCount} lời mời đang chờ` } : null,
    showSystemNotifications && notificationCount > 0 ? { key: "notifications", text: `${notificationCount} thông báo quy trình` } : null,
    !roleCanApproveVoucher(role) && myDraftCount > 0 ? { key: "drafts", text: `${myDraftCount} phiếu nháp của bạn` } : null,
  ].filter((item): item is SidebarHotItem => Boolean(item));

  return (
    <aside className="hidden w-72 shrink-0 border-r border-amber-100 bg-white/95 p-4 md:block">
      <div className="space-y-3 rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-semibold text-slate-900">Hệ thống quản lý dòng họ</div>
            <div className="text-xs text-slate-600">
              Quản lý hồ sơ thành viên, tài khoản và hoạt động chung
            </div>
          </div>
          <Badge variant="outline">{roleLabel(role)}</Badge>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Dòng họ đang làm việc
          </div>

          {clans.length > 0 ? (
            <form action={switchActiveClanAction} className="space-y-2">
              <select
                name="clanId"
                defaultValue={activeClan?.clan_id ?? activeClanId}
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              >
                {clans.map((clan) => (
                  <option key={clan.clan_id} value={clan.clan_id}>
                    {clan.clan_name} • {roleLabel(clan.role)}
                  </option>
                ))}
              </select>

              <button
                type="submit"
                className="inline-flex h-9 items-center rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50"
              >
                Chuyển dòng họ
              </button>
            </form>
          ) : (
            <div className="text-sm text-slate-500">Chưa tham gia dòng họ nào.</div>
          )}
        </div>
      </div>

      <SidebarNavClient items={navItems} badgeEntries={Array.from(navBadges.entries())} hotItems={hotItems} />

      <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        Dữ liệu luôn bám theo dòng họ đang chọn để tránh lẫn thông tin khi một tài khoản tham gia
        nhiều dòng họ.
      </div>

      <div className="mt-6">
        <Link href="/logout" className="text-sm text-slate-600 hover:underline">
          Đăng xuất
        </Link>
      </div>
    </aside>
  );
}
