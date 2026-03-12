import Link from "next/link";
import { requireAuth } from "@/lib/auth/context";
import { createSupabaseServerComponentClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { eventTypeLabel, formatDateVi } from "@/lib/i18n/labels";

export default async function EventsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; created?: string }> }) {
  const ctx = await requireAuth();
  const { from, to, created } = await searchParams;

  const supabase = await createSupabaseServerComponentClient();

  const now = new Date();
  const defaultFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
  const defaultTo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);

  const f = from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : defaultFrom;
  const t = to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : defaultTo;

  const [{ data: events }, { data: members }] = await Promise.all([
    supabase
      .from("events")
      .select("id,title,event_type,event_date,member_id,note,created_at")
      .eq("clan_id", ctx.activeClanId)
      .gte("event_date", f)
      .lt("event_date", t)
      .order("event_date", { ascending: true })
      .limit(500),
    supabase
      .from("members")
      .select("id,full_name")
      .eq("clan_id", ctx.activeClanId)
      .order("full_name", { ascending: true })
      .limit(2000),
  ]);
  const memberMap = new Map((members ?? []).map((m) => [m.id, m.full_name]));

  const canManage = ctx.role === "admin" || ctx.role === "clan_manager";

  return (
    <div className="space-y-4">
      <PageHeader
        title="Sự kiện"
        subtitle="Ngày giỗ, họp họ, sinh nhật và các sự kiện của dòng họ"
        right={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/dashboard">Tổng quan</Link>
            </Button>
            {canManage ? (
              <Button asChild>
                <Link href="/events/new">Tạo sự kiện</Link>
              </Button>
            ) : null}
          </div>
        }
      />

      {created === "1" ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          Đã tạo sự kiện thành công. Danh sách đang hiển thị đúng tháng của sự kiện vừa lưu.
        </div>
      ) : null}

      <Card>
        <CardContent className="space-y-3">
          <form className="flex flex-wrap items-end gap-2" method="get" action="/events">
            <div className="space-y-1">
              <label className="text-xs text-slate-600">Từ ngày</label>
              <input type="date" name="from" defaultValue={f} className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-600">Đến ngày</label>
              <input type="date" name="to" defaultValue={t} className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm" />
            </div>
            <Button type="submit" variant="outline">
              Lọc dữ liệu
            </Button>
          </form>

          {!events || events.length === 0 ? (
            <p className="text-sm text-slate-600">Không có sự kiện nào trong khoảng thời gian này.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH>Ngày</TH>
                    <TH>Tiêu đề</TH>
                    <TH>Loại</TH>
                    <TH>Thành viên</TH>
                    <TH>Ghi chú</TH>
                  </TR>
                </THead>
                <TBody>
                  {events.map((e) => (
                    <TR key={e.id}>
                      <TD className="whitespace-nowrap">{formatDateVi(e.event_date)}</TD>
                      <TD>
                        <Link className="underline" href={`/events/${e.id}`}>
                          {e.title}
                        </Link>
                      </TD>
                      <TD className="whitespace-nowrap">{eventTypeLabel(e.event_type)}</TD>
                      <TD className="whitespace-nowrap">{e.member_id ? memberMap.get(e.member_id) ?? "-" : "-"}</TD>
                      <TD className="max-w-[360px] truncate">{e.note ?? ""}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
