import Link from "next/link";
import { requireAuth } from "@/lib/auth/context";
import { createSupabaseServerComponentClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { documentVisibilityLabel, formatDateVi } from "@/lib/i18n/labels";

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ q?: string; type?: string; visibility?: string }> }) {
  const ctx = await requireAuth();
  const { q, type, visibility } = await searchParams;
  const supabase = await createSupabaseServerComponentClient();

  let query = supabase
    .from("documents")
    .select("id,title,doc_type,created_at,tags,visibility,member_id,event_id")
    .eq("clan_id", ctx.activeClanId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (q?.trim()) query = query.ilike("title", `%${q.trim()}%`);
  if (type && ["PDF", "IMAGE", "OTHER"].includes(type)) query = query.eq("doc_type", type);
  if (visibility && ["CLAN", "PUBLIC", "MANAGER_ONLY"].includes(visibility)) query = query.eq("visibility", visibility);

  const [{ data: docs }, { data: members }, { data: events }] = await Promise.all([
    query,
    supabase.from("members").select("id,full_name").eq("clan_id", ctx.activeClanId).limit(5000),
    supabase.from("events").select("id,title").eq("clan_id", ctx.activeClanId).limit(2000),
  ]);
  const canManage = ctx.role === "admin" || ctx.role === "clan_manager";
  const memberMap = new Map((members ?? []).map((m) => [m.id, m.full_name]));
  const eventMap = new Map((events ?? []).map((e) => [e.id, e.title]));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Tư liệu số"
        subtitle="Kho lưu trữ tài liệu, ảnh và tư liệu của dòng họ"
        right={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/dashboard">Tổng quan</Link>
            </Button>
            {canManage ? (
              <Button asChild>
                <Link href="/documents/upload">Tải tư liệu lên</Link>
              </Button>
            ) : null}
          </div>
        }
      />
      <Card>
        <CardContent className="space-y-3 p-4">
          <form method="get" action="/documents" className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <label className="text-xs text-slate-600">Từ khóa</label>
              <input name="q" defaultValue={q ?? ""} className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-600">Loại tài liệu</label>
              <select name="type" defaultValue={type ?? ""} className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm">
                <option value="">Tất cả</option>
                <option value="PDF">PDF</option>
                <option value="IMAGE">Ảnh</option>
                <option value="OTHER">Khác</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-600">Mức hiển thị</label>
              <select name="visibility" defaultValue={visibility ?? ""} className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm">
                <option value="">Tất cả</option>
                <option value="CLAN">Trong dòng họ</option>
                <option value="PUBLIC">Công khai</option>
                {canManage ? <option value="MANAGER_ONLY">Chỉ ban quản lý</option> : null}
              </select>
            </div>
            <Button type="submit" variant="outline">
              Lọc dữ liệu
            </Button>
          </form>

          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>Tiêu đề</TH>
                  <TH>Loại</TH>
                  <TH>Thẻ</TH>
                  <TH>Liên kết</TH>
                  <TH>Mức hiển thị</TH>
                  <TH>Ngày tạo</TH>
                </TR>
              </THead>
              <TBody>
                {(docs ?? []).map((d) => (
                  <TR key={d.id}>
                    <TD>
                      <Link className="underline" href={`/documents/${d.id}`}>
                        {d.title}
                      </Link>
                    </TD>
                    <TD className="whitespace-nowrap">{d.doc_type === "IMAGE" ? "Ảnh" : d.doc_type === "OTHER" ? "Khác" : d.doc_type}</TD>
                    <TD className="whitespace-nowrap text-xs">{(d.tags ?? []).join(", ") || "-"}</TD>
                    <TD className="whitespace-nowrap text-xs">
                      {d.member_id ? `Thành viên: ${memberMap.get(d.member_id) ?? d.member_id}` : d.event_id ? `Sự kiện: ${eventMap.get(d.event_id) ?? d.event_id}` : "-"}
                    </TD>
                    <TD className="whitespace-nowrap">{documentVisibilityLabel(d.visibility)}</TD>
                    <TD className="whitespace-nowrap">{formatDateVi(d.created_at)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            {!docs || docs.length === 0 ? <div className="p-4 text-sm text-slate-600">Chưa có tư liệu nào.</div> : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
