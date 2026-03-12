import Link from "next/link";
import { requireAuth } from "@/lib/auth/context";
import { createSupabaseServerComponentClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NotificationForm } from "./ui";
import { notificationKindLabel } from "@/lib/i18n/labels";
import { NotificationsSeenMarker } from "./seen-marker";

export default async function NotificationsPage() {
  const ctx = await requireAuth();
  const supabase = await createSupabaseServerComponentClient();
  const showSystemNotifications = ctx.role !== "member";

  const [{ data: notifications }, { data: events }] = await Promise.all([
    supabase
      .from("notifications")
      .select("id,title,body,kind,scheduled_for,is_pinned,created_at,event_id")
      .eq("clan_id", ctx.activeClanId)
      .order("is_pinned", { ascending: false })
      .order("scheduled_for", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(120),
    supabase.from("events").select("id,title,event_date").eq("clan_id", ctx.activeClanId).order("event_date", { ascending: true }).limit(200),
  ]);

  const eventMap = new Map((events ?? []).map((e) => [e.id, `${e.title} (${e.event_date})`]));
  const canManage = ctx.role === "admin" || ctx.role === "clan_manager";
  const systemNotifications = (notifications ?? []).filter((item) => item.kind?.startsWith("SYSTEM_"));
  const manualNotifications = (notifications ?? []).filter((item) => !item.kind?.startsWith("SYSTEM_"));

  return (
    <div className="space-y-4">
      {showSystemNotifications ? <NotificationsSeenMarker clanId={ctx.activeClanId} /> : null}

      <PageHeader
        title="Thông báo & nhắc lịch"
        subtitle={showSystemNotifications
          ? "Tin nội bộ, lịch họp họ và các thông báo trạng thái phát sinh từ quy trình duyệt phiếu hoặc lời mời"
          : "Tin nội bộ và lịch họp họ dành cho thành viên trong dòng họ"}
        right={canManage ? <Button asChild variant="outline"><Link href="/admin/action-logs">Mở nhật ký thao tác</Link></Button> : undefined}
      />

      {canManage ? (
        <Card>
          <CardHeader><div className="font-semibold">Đăng thông báo mới</div></CardHeader>
          <CardContent><NotificationForm events={events ?? []} /></CardContent>
        </Card>
      ) : null}

      <div className={showSystemNotifications ? "grid gap-4 xl:grid-cols-[1.1fr_0.9fr]" : "grid gap-4"}>
        <Card>
          <CardHeader><div className="font-semibold">Bảng tin dòng họ</div></CardHeader>
          <CardContent>
            {manualNotifications.length === 0 ? (
              <p className="text-sm text-slate-600">Chưa có thông báo thủ công nào.</p>
            ) : (
              <ul className="space-y-3">
                {manualNotifications.map((item) => (
                  <li key={item.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-medium">{item.title}</div>
                      <div className="text-xs text-slate-500">{notificationKindLabel(item.kind)}{item.is_pinned ? " · ghim" : ""}</div>
                    </div>
                    <div className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{item.body ?? "(không có nội dung)"}</div>
                    <div className="mt-2 text-xs text-slate-500">
                      {item.event_id ? `Gắn với sự kiện: ${eventMap.get(item.event_id) ?? item.event_id} · ` : ""}
                      {item.scheduled_for ? `Nhắc ngày ${item.scheduled_for}` : `Tạo lúc ${new Date(item.created_at).toLocaleString("vi-VN")}`}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {showSystemNotifications ? (
          <Card>
            <CardHeader><div className="font-semibold">Thông báo từ quy trình hệ thống</div></CardHeader>
            <CardContent>
              {systemNotifications.length === 0 ? (
                <p className="text-sm text-slate-600">Chưa có thông báo hệ thống nào.</p>
              ) : (
                <ul className="space-y-3">
                  {systemNotifications.map((item) => (
                    <li key={item.id} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                      <div className="font-medium text-amber-950">{item.title}</div>
                      <div className="mt-1 whitespace-pre-wrap text-sm text-amber-900">{item.body ?? "(không có nội dung)"}</div>
                      <div className="mt-2 text-xs text-amber-800">{new Date(item.created_at).toLocaleString("vi-VN")}</div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
