import Link from "next/link";
import { requireAuth, requireRole } from "@/lib/auth/context";
import { createSupabaseServerComponentClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDateVi } from "@/lib/i18n/labels";

type ActionLogRow = {
  id: string;
  created_at: string;
  created_by: string | null;
  entity_type: string;
  entity_id: string | null;
  action: string;
  metadata: unknown | null;
};

function shortId(id: string) {
  return id.length > 10 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id;
}

export default async function ActionLogsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await requireAuth();
  requireRole(ctx, ["admin", "clan_manager"]);
  const sp = await searchParams;

  const supabase = await createSupabaseServerComponentClient();
  let query = supabase
    .from("action_logs")
    .select("id,created_at,created_by,entity_type,entity_id,action,metadata")
    .eq("clan_id", ctx.activeClanId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (sp.entity) query = query.eq("entity_type", sp.entity);
  if (sp.action) query = query.eq("action", sp.action);

  const { data: logs, error } = await query.returns<ActionLogRow[]>();
  const actorIds = Array.from(new Set((logs ?? []).map((l) => l.created_by).filter((v): v is string => Boolean(v))));
  const { data: profiles } = actorIds.length > 0
    ? await supabase.from("profiles").select("user_id,full_name").in("user_id", actorIds)
    : { data: [] as Array<{ user_id: string; full_name: string | null }> };
  const actorMap = new Map((profiles ?? []).map((item) => [item.user_id, item.full_name ?? shortId(item.user_id)]));
  const entityOptions = Array.from(new Set((logs ?? []).map((l) => l.entity_type))).sort();
  const actionOptions = Array.from(new Set((logs ?? []).map((l) => l.action))).sort();

  return (
    <div className="space-y-4">
      <PageHeader
        title="Nhật ký thao tác"
        subtitle="Theo dõi ai đã tạo, sửa, xóa, liên kết hoặc duyệt dữ liệu trong hệ thống"
        right={
          <div className="flex gap-2">
            <Button asChild variant="outline"><Link href="/admin/permissions">Ma trận quyền</Link></Button>
            <Button asChild variant="outline"><Link href="/admin/users-roles">Người dùng & hồ sơ</Link></Button>
          </div>
        }
      />

      <Card>
        <CardContent className="space-y-4 p-4">
          <form className="flex flex-wrap items-end gap-2" action="/admin/action-logs" method="get">
            <div className="space-y-1">
              <label className="text-xs text-slate-500">Đối tượng</label>
              <select name="entity" defaultValue={sp.entity ?? ""} className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm">
                <option value="">Tất cả</option>
                {entityOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-500">Hành động</label>
              <select name="action" defaultValue={sp.action ?? ""} className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm">
                <option value="">Tất cả</option>
                {actionOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
            <Button type="submit" variant="outline">Lọc nhật ký</Button>
          </form>

          {error ? (
            <div className="text-sm text-red-600">{error.message}</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH>Thời gian</TH>
                    <TH>Người thực hiện</TH>
                    <TH>Đối tượng</TH>
                    <TH>Hành động</TH>
                    <TH>Chi tiết</TH>
                  </TR>
                </THead>
                <TBody>
                  {(logs ?? []).map((l) => (
                    <TR key={l.id}>
                      <TD className="whitespace-nowrap">{formatDateVi(l.created_at)} {new Date(l.created_at).toLocaleTimeString("vi-VN")}</TD>
                      <TD className="whitespace-nowrap">{l.created_by ? actorMap.get(l.created_by) ?? shortId(l.created_by) : "Hệ thống"}</TD>
                      <TD className="whitespace-nowrap">
                        {l.entity_type}
                        {l.entity_id ? `:${shortId(l.entity_id)}` : ""}
                      </TD>
                      <TD className="whitespace-nowrap">{l.action}</TD>
                      <TD className="max-w-[560px] text-xs text-slate-600">
                        <pre className="whitespace-pre-wrap break-words">{l.metadata ? JSON.stringify(l.metadata, null, 2) : "-"}</pre>
                      </TD>
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
