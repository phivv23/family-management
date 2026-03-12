import Link from "next/link";
import { requireAuth } from "@/lib/auth/context";
import { createSupabaseServerComponentClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatMoney } from "@/lib/format/money";
import { eventTypeLabel, formatDateVi, notificationKindLabel, roleLabel, voucherStatusLabel, voucherTypeLabel } from "@/lib/i18n/labels";
import { roleCanApproveVoucher, roleCanCreateVoucher } from "@/lib/access/role-capabilities";
import { approveVoucherAction } from "../vouchers/actions";
import { cookies } from "next/headers";
import { normalizeSeenAtCookie, systemNotificationSeenCookieName } from "@/lib/notifications/seen";

function monthStart(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}
function monthEnd(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
}
function addDays(d: Date, n: number) {
  const x = new Date(d.getTime());
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

function CountPill({ count }: { count: number }) {
  return (
    <span className="inline-flex min-w-7 items-center justify-center rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
      {count}
    </span>
  );
}

function TaskCard({ title, count, body, href, cta }: { title: string; count: number; body: string; href: string; cta: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          <div className="mt-1 text-sm text-slate-600">{body}</div>
        </div>
        <CountPill count={count} />
      </div>
      <div className="mt-3">
        <Button asChild size="sm" variant="outline">
          <Link href={href}>{cta}</Link>
        </Button>
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const ctx = await requireAuth();
  const supabase = await createSupabaseServerComponentClient();

  const now = new Date();
  const from = monthStart(now).toISOString().slice(0, 10);
  const to = monthEnd(now).toISOString().slice(0, 10);
  const upFrom = now.toISOString().slice(0, 10);
  const upTo = addDays(now, 30).toISOString().slice(0, 10);
  const systemSince = addDays(now, -7).toISOString();
  const canApprove = roleCanApproveVoucher(ctx.role);
  const canManageProfiles = ["admin", "clan_manager"].includes(ctx.role);
  const showSystemNotifications = ctx.role !== "member";
  const cookieStore = await cookies();
  const seenAt = normalizeSeenAtCookie(cookieStore.get(systemNotificationSeenCookieName(ctx.activeClanId))?.value);

  const [
    fundsRes,
    monthlyVouchersRes,
    vouchersRes,
    pendingQueueRes,
    eventsRes,
    membersRes,
    memberCountRes,
    documentCountRes,
    pendingVoucherCountRes,
    eventCountRes,
    notificationsRes,
    meRes,
    updateReqCountRes,
    pendingUpdateReqCountRes,
    pendingInvitationCountRes,
    recentSystemNotificationCountRes,
  ] = await Promise.all([
    supabase.from("funds").select("id,name,currency").eq("clan_id", ctx.activeClanId),
    supabase
      .from("vouchers")
      .select("id,status,voucher_type,amount,voucher_date,created_by")
      .eq("clan_id", ctx.activeClanId)
      .gte("voucher_date", from)
      .lt("voucher_date", to),
    supabase
      .from("vouchers")
      .select("id,title,status,voucher_type,amount,voucher_date")
      .eq("clan_id", ctx.activeClanId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("vouchers")
      .select("id,title,status,voucher_type,amount,voucher_date,created_by,member_id,household_label,fund_id")
      .eq("clan_id", ctx.activeClanId)
      .eq("status", "PENDING")
      .order("voucher_date", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(6),
    supabase
      .from("events")
      .select("id,title,event_type,event_date,member_id")
      .eq("clan_id", ctx.activeClanId)
      .gte("event_date", upFrom)
      .lt("event_date", upTo)
      .order("event_date", { ascending: true })
      .limit(20),
    supabase
      .from("members")
      .select("id,full_name")
      .eq("clan_id", ctx.activeClanId)
      .order("full_name", { ascending: true })
      .limit(2000),
    supabase.from("members").select("id", { head: true, count: "exact" }).eq("clan_id", ctx.activeClanId),
    supabase.from("documents").select("id", { head: true, count: "exact" }).eq("clan_id", ctx.activeClanId),
    supabase.from("vouchers").select("id", { head: true, count: "exact" }).eq("clan_id", ctx.activeClanId).eq("status", "PENDING"),
    supabase.from("events").select("id", { head: true, count: "exact" }).eq("clan_id", ctx.activeClanId).gte("event_date", from).lt("event_date", to),
    supabase
      .from("notifications")
      .select("id,title,kind,scheduled_for,is_pinned,created_at")
      .eq("clan_id", ctx.activeClanId)
      .order("is_pinned", { ascending: false })
      .order("scheduled_for", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(5),
    ctx.linkedMemberId
      ? supabase.from("members").select("id,full_name").eq("clan_id", ctx.activeClanId).eq("id", ctx.linkedMemberId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    ctx.linkedMemberId
      ? supabase
          .from("member_update_requests")
          .select("id", { head: true, count: "exact" })
          .eq("clan_id", ctx.activeClanId)
          .eq("member_id", ctx.linkedMemberId)
      : Promise.resolve({ count: 0, data: null, error: null }),
    canManageProfiles
      ? supabase
          .from("member_update_requests")
          .select("id", { head: true, count: "exact" })
          .eq("clan_id", ctx.activeClanId)
          .eq("status", "PENDING")
      : Promise.resolve({ count: 0, data: null, error: null }),
    canManageProfiles
      ? supabase
          .from("clan_invitations")
          .select("id", { head: true, count: "exact" })
          .eq("clan_id", ctx.activeClanId)
          .eq("status", "PENDING")
      : Promise.resolve({ count: 0, data: null, error: null }),
    showSystemNotifications
      ? (() => {
          let query = supabase
            .from("notifications")
            .select("id", { head: true, count: "exact" })
            .eq("clan_id", ctx.activeClanId)
            .like("kind", "SYSTEM_%")
            .gte("created_at", systemSince);
          if (seenAt) query = query.gt("created_at", seenAt);
          return query;
        })()
      : Promise.resolve({ count: 0, data: null, error: null }),
  ]);

  const funds = fundsRes.data ?? [];
  const monthlyVouchers = monthlyVouchersRes.data ?? [];
  const vouchers = vouchersRes.data ?? [];
  const pendingQueue = pendingQueueRes.data ?? [];
  const events = eventsRes.data;
  const members = membersRes.data;
  const notifications = (notificationsRes.data ?? []).filter((item) => showSystemNotifications || !item.kind?.startsWith("SYSTEM_"));
  const defaultCurrency = funds[0]?.currency ?? "VND";
  const fundMap = new Map(funds.map((item) => [item.id, item]));

  const approvedThisMonth = monthlyVouchers.filter((v) => v.status === "APPROVED");
  const pendingThisMonth = monthlyVouchers.filter((v) => v.status === "PENDING");
  const draftThisMonth = monthlyVouchers.filter((v) => v.status === "DRAFT");
  const rejectedThisMonth = monthlyVouchers.filter((v) => v.status === "REJECTED");
  const myDraftsThisMonth = draftThisMonth.filter((v) => v.created_by === ctx.userId);
  const myPendingThisMonth = pendingThisMonth.filter((v) => v.created_by === ctx.userId);

  const incomeApproved = approvedThisMonth
    .filter((v) => v.voucher_type === "INCOME")
    .reduce((s, v) => s + Number(v.amount), 0);
  const expenseApproved = approvedThisMonth
    .filter((v) => v.voucher_type === "EXPENSE")
    .reduce((s, v) => s + Number(v.amount), 0);
  const pendingAmount = pendingThisMonth.reduce((s, v) => s + Number(v.amount), 0);
  const draftAmount = draftThisMonth.reduce((s, v) => s + Number(v.amount), 0);

  const memberMap = new Map((members ?? []).map((m) => [m.id, m.full_name]));
  const actorIds = Array.from(
    new Set([
      ...pendingQueue.map((item) => item.created_by).filter((v): v is string => Boolean(v)),
      ...monthlyVouchers.map((item) => item.created_by).filter((v): v is string => Boolean(v)),
    ])
  );
  const { data: actorProfiles } = actorIds.length > 0
    ? await supabase.from("profiles").select("user_id,full_name").in("user_id", actorIds)
    : { data: [] as Array<{ user_id: string; full_name: string | null }> };
  const actorMap = new Map((actorProfiles ?? []).map((item) => [item.user_id, item.full_name ?? item.user_id]));

  const memberCount = memberCountRes.count ?? 0;
  const documentCount = documentCountRes.count ?? 0;
  const pendingVoucherCount = pendingVoucherCountRes.count ?? 0;
  const eventCount = eventCountRes.count ?? 0;
  const myMember = meRes.data;
  const myUpdateReqCount = updateReqCountRes.count ?? 0;
  const pendingUpdateReqCount = pendingUpdateReqCountRes.count ?? 0;
  const pendingInvitationCount = pendingInvitationCountRes.count ?? 0;
  const recentSystemNotificationCount = recentSystemNotificationCountRes.count ?? 0;

  const quickLinks = [
    { href: "/me", label: myMember ? `Hồ sơ của tôi · ${myMember.full_name}` : "Liên kết hồ sơ của tôi", show: true },
    { href: "/members/new", label: "Thêm thành viên", show: ctx.role === "admin" || ctx.role === "clan_manager" },
    { href: "/vouchers/new", label: ctx.role === "member" ? "Tạo đề nghị chi" : "Lập phiếu thu chi", show: roleCanCreateVoucher(ctx.role) },
    { href: "/vouchers", label: canApprove ? "Mở hàng chờ duyệt" : "Mở sổ thu chi", show: true },
    { href: "/reports/monthly", label: "Báo cáo tháng", show: ["admin", "clan_manager", "treasurer", "approver"].includes(ctx.role) },
    { href: "/events/new", label: "Tạo sự kiện", show: ctx.role === "admin" || ctx.role === "clan_manager" },
    { href: "/notifications", label: "Thông báo dòng họ", show: true },
    { href: "/contributions", label: "Minh bạch đóng góp", show: true },
    { href: "/admin/permissions", label: "Ma trận quyền", show: ["admin", "clan_manager", "treasurer", "approver"].includes(ctx.role) },
  ].filter((item) => item.show);

  const urgentTasks = [
    canApprove && pendingVoucherCount > 0
      ? { title: "Phiếu chờ duyệt", count: pendingVoucherCount, body: "Có phiếu đang cần kiểm tra và ra quyết định.", href: "/vouchers", cta: "Mở hàng chờ" }
      : null,
    canManageProfiles && pendingUpdateReqCount > 0
      ? { title: "Đề xuất cập nhật hồ sơ", count: pendingUpdateReqCount, body: "Cần duyệt hoặc từ chối các yêu cầu chỉnh sửa hồ sơ thành viên.", href: "/admin/update-requests", cta: "Mở duyệt hồ sơ" }
      : null,
    canManageProfiles && pendingInvitationCount > 0
      ? { title: "Lời mời chờ phản hồi", count: pendingInvitationCount, body: "Nên rà lại các email/link mời còn treo để tránh nhầm liên kết tài khoản.", href: "/admin/users-roles", cta: "Mở người dùng" }
      : null,
    showSystemNotifications && recentSystemNotificationCount > 0
      ? { title: "Thông báo hệ thống mới", count: recentSystemNotificationCount, body: "Có thông báo quy trình mới phát sinh trong 7 ngày gần đây.", href: "/notifications", cta: "Xem thông báo" }
      : null,
    roleCanCreateVoucher(ctx.role) && myDraftsThisMonth.length > 0
      ? { title: "Bản nháp của bạn", count: myDraftsThisMonth.length, body: "Có phiếu đang dừng ở bản nháp, chưa gửi sang bước kiểm soát.", href: "/vouchers", cta: "Mở phiếu của tôi" }
      : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

  async function approveFromDashboard(formData: FormData) {
    "use server";
    const voucherId = String(formData.get("voucherId") ?? "");
    if (!voucherId) return;
    await approveVoucherAction(voucherId);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Tổng quan"
        subtitle={`Vai trò hiện tại: ${roleLabel(ctx.role)}`}
        right={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/notifications">Thông báo</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/reports/monthly">Báo cáo tháng</Link>
            </Button>
            <Button asChild>
              <Link href="/members/tree">Cây gia phả</Link>
            </Button>
          </div>
        }
      />

      {urgentTasks.length > 0 ? (
        <Card>
          <CardHeader><div className="font-semibold">Việc cần làm ngay</div></CardHeader>
          <CardContent>
            <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
              {urgentTasks.map((task) => (
                <TaskCard key={`${task.href}-${task.title}`} {...task} />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader><div className="font-semibold">Tài chính tháng này</div></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <Card>
              <CardHeader><div className="text-xs text-slate-600">Thu đã duyệt</div></CardHeader>
              <CardContent><div className="text-2xl font-semibold">{formatMoney(incomeApproved, defaultCurrency)}</div></CardContent>
            </Card>
            <Card>
              <CardHeader><div className="text-xs text-slate-600">Chi đã duyệt</div></CardHeader>
              <CardContent><div className="text-2xl font-semibold">{formatMoney(expenseApproved, defaultCurrency)}</div></CardContent>
            </Card>
            <Card>
              <CardHeader><div className="text-xs text-slate-600">Chênh lệch</div></CardHeader>
              <CardContent><div className="text-2xl font-semibold">{formatMoney(incomeApproved - expenseApproved, defaultCurrency)}</div></CardContent>
            </Card>
            <Card>
              <CardHeader><div className="text-xs text-slate-600">Chờ duyệt</div></CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{pendingThisMonth.length}</div>
                <div className="text-xs text-slate-500">{formatMoney(pendingAmount, defaultCurrency)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><div className="text-xs text-slate-600">Bản nháp</div></CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{draftThisMonth.length}</div>
                <div className="text-xs text-slate-500">{formatMoney(draftAmount, defaultCurrency)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><div className="text-xs text-slate-600">Từ chối</div></CardHeader>
              <CardContent><div className="text-2xl font-semibold">{rejectedThisMonth.length}</div></CardContent>
            </Card>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline"><Link href="/vouchers">Sổ phiếu</Link></Button>
            <Button asChild variant="outline"><Link href="/reports/monthly">Báo cáo tháng</Link></Button>
            {roleCanCreateVoucher(ctx.role) ? (
              <Button asChild><Link href="/vouchers/new">{ctx.role === "member" ? "Tạo đề nghị chi" : "Lập phiếu mới"}</Link></Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader><div className="text-xs text-slate-600">Số thành viên</div></CardHeader>
          <CardContent><div className="text-2xl font-semibold">{memberCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader><div className="text-xs text-slate-600">Tư liệu số</div></CardHeader>
          <CardContent><div className="text-2xl font-semibold">{documentCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader><div className="text-xs text-slate-600">Sự kiện tháng này</div></CardHeader>
          <CardContent><div className="text-2xl font-semibold">{eventCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader><div className="text-xs text-slate-600">Đề xuất hồ sơ của tôi</div></CardHeader>
          <CardContent><div className="text-2xl font-semibold">{myUpdateReqCount}</div></CardContent>
        </Card>
      </div>

      {canApprove ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="font-semibold">Hàng chờ duyệt</div>
              {pendingVoucherCount > 0 ? <CountPill count={pendingVoucherCount} /> : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingQueue.length === 0 ? (
              <p className="text-sm text-slate-600">Hiện chưa có phiếu nào đang chờ duyệt.</p>
            ) : (
              <div className="space-y-3">
                {pendingQueue.map((item) => {
                  const creatorName = actorMap.get(item.created_by ?? "") ?? item.created_by ?? "-";
                  const fund = item.fund_id ? fundMap.get(item.fund_id) : undefined;
                  const ownerLabel = item.member_id ? memberMap.get(item.member_id) ?? item.member_id : item.household_label ?? "-";
                  const canQuickApprove = item.created_by !== ctx.userId;
                  return (
                    <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="space-y-1">
                          <Link href={`/vouchers/${item.id}`} className="text-base font-semibold underline">
                            {item.title}
                          </Link>
                          <div className="text-sm text-slate-600">
                            {voucherTypeLabel(item.voucher_type)} · {formatMoney(Number(item.amount), fund?.currency ?? defaultCurrency)} · {formatDateVi(item.voucher_date)}
                          </div>
                          <div className="text-xs text-slate-500">
                            Người lập: {creatorName} · Đối tượng liên quan: {ownerLabel} · Quỹ: {fund?.name ?? "-"}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button asChild variant="outline"><Link href={`/vouchers/${item.id}`}>Mở chi tiết</Link></Button>
                          {canQuickApprove ? (
                            <form action={approveFromDashboard}>
                              <input type="hidden" name="voucherId" value={item.id} />
                              <Button type="submit">Duyệt nhanh</Button>
                            </form>
                          ) : (
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">Bạn là người lập phiếu này nên không được tự duyệt.</div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-3">
        <Card>
          <CardHeader><div className="font-semibold">Sự kiện trong 30 ngày tới</div></CardHeader>
          <CardContent>
            {!events || events.length === 0 ? (
              <p className="text-sm text-slate-600">Chưa có sự kiện sắp tới.</p>
            ) : (
              <ul className="space-y-2">
                {events.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <Link className="text-sm underline" href={`/events/${e.id}`}>
                        {e.title}
                      </Link>
                      <div className="text-xs text-slate-600">
                        {eventTypeLabel(e.event_type)}
                        {e.member_id ? ` · ${memberMap.get(e.member_id) ?? ""}` : ""}
                      </div>
                    </div>
                    <span className="whitespace-nowrap text-sm text-slate-700">{formatDateVi(e.event_date)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><div className="font-semibold">Phiếu gần đây</div></CardHeader>
          <CardContent>
            {!vouchers || vouchers.length === 0 ? (
              <p className="text-sm text-slate-600">Chưa có phiếu nào.</p>
            ) : (
              <ul className="space-y-2">
                {vouchers.map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-2">
                    <Link className="truncate text-sm underline" href={`/vouchers/${v.id}`}>
                      {v.title}
                    </Link>
                    <span className="whitespace-nowrap text-xs text-slate-700">
                      {voucherTypeLabel(v.voucher_type)} · {voucherStatusLabel(v.status)} · {formatMoney(Number(v.amount), defaultCurrency)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="font-semibold">Thông báo mới</div>
              {showSystemNotifications && recentSystemNotificationCount > 0 ? <CountPill count={recentSystemNotificationCount} /> : null}
            </div>
          </CardHeader>
          <CardContent>
            {notifications.length === 0 ? (
              <p className="text-sm text-slate-600">Chưa có thông báo nào.</p>
            ) : (
              <ul className="space-y-2">
                {notifications.map((n) => (
                  <li key={n.id} className="rounded-lg border border-slate-200 bg-white p-2">
                    <div className="flex items-center justify-between gap-2">
                      <Link href="/notifications" className="text-sm font-medium underline">
                        {n.title}
                      </Link>
                      <span className="text-[11px] text-slate-500">{notificationKindLabel(n.kind)}</span>
                    </div>
                    <div className="text-xs text-slate-500">
                      {n.scheduled_for ? `Nhắc ngày ${formatDateVi(n.scheduled_for)}` : `Tạo lúc ${formatDateVi(n.created_at)}`}
                      {n.is_pinned ? " · ghim" : ""}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardHeader><div className="font-semibold">Hồ sơ tài khoản của tôi</div></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div><span className="text-slate-500">Tên tài khoản:</span> {ctx.profile.full_name ?? "(chưa có tên hồ sơ)"}</div>
            <div><span className="text-slate-500">Liên kết gia phả:</span> {myMember?.full_name ?? "Chưa liên kết với thành viên trong cây"}</div>
            <div><span className="text-slate-500">Đề xuất cập nhật hồ sơ:</span> {myUpdateReqCount}</div>
            <div className="pt-1">
              <Button asChild variant="outline"><Link href="/me">Mở hồ sơ của tôi</Link></Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><div className="font-semibold">Thao tác nhanh</div></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {quickLinks.map((link) => (
              <Button asChild key={link.href} variant="outline">
                <Link href={link.href}>{link.label}</Link>
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
