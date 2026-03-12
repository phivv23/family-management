import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/context";
import { createSupabaseServerComponentClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { deleteDocumentAction } from "../actions";
import { documentVisibilityLabel, formatDateVi } from "@/lib/i18n/labels";
import { assertSupabaseQuery } from "@/lib/supabase/assert";

type DocumentAttachmentRow = {
  created_at: string;
  attachments:
    | { id: string; bucket: string; object_path: string; file_name: string; size_bytes: number | string; created_at: string }
    | null;
};

export default async function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAuth();
  const { id } = await params;
  const supabase = await createSupabaseServerComponentClient();

  const docRes = await supabase
    .from("documents")
    .select("id,title,description,doc_type,created_at,tags,visibility,member_id,event_id")
    .eq("id", id)
    .eq("clan_id", ctx.activeClanId)
    .maybeSingle();
  const doc = assertSupabaseQuery("documents.detail", docRes.data, docRes.error);
  if (!doc) return notFound();

  const [{ data: attachmentRows }, memberRes, eventRes] = await Promise.all([
    supabase
      .from("document_attachments")
      .select("created_at, attachments(id,bucket,object_path,file_name,size_bytes,created_at)")
      .eq("clan_id", ctx.activeClanId)
      .eq("document_id", id)
      .order("created_at", { ascending: false })
      .returns<DocumentAttachmentRow[]>(),
    doc.member_id ? supabase.from("members").select("id,full_name").eq("clan_id", ctx.activeClanId).eq("id", doc.member_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    doc.event_id ? supabase.from("events").select("id,title,event_date").eq("clan_id", ctx.activeClanId).eq("id", doc.event_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);

  const files = (attachmentRows ?? [])
    .map((r) => r.attachments)
    .filter((a): a is NonNullable<DocumentAttachmentRow["attachments"]> => Boolean(a));

  const signedUrlPairs = await Promise.all((files ?? []).map(async (a) => {
    const { data: signed } = await supabase.storage.from(a.bucket).createSignedUrl(a.object_path, 60);
    return signed?.signedUrl ? ([a.id, signed.signedUrl] as const) : null;
  }));
  const signedUrls = new Map<string, string>(signedUrlPairs.filter((x): x is readonly [string, string] => Boolean(x)));

  const canManage = ctx.role === "admin" || ctx.role === "clan_manager";

  async function destroy() {
    "use server";
    const res = await deleteDocumentAction(id);
    if (!res.ok) redirect(`/documents/${id}?error=delete_failed`);
    redirect("/documents");
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={doc.title}
        subtitle={`${doc.doc_type === "IMAGE" ? "Ảnh" : doc.doc_type === "OTHER" ? "Khác" : doc.doc_type} · tạo ngày ${formatDateVi(doc.created_at)}`}
        right={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/documents">Quay lại</Link>
            </Button>
            {canManage ? (
              <form action={destroy}>
                <Button type="submit" variant="outline">Xóa tài liệu</Button>
              </form>
            ) : null}
          </div>
        }
      />

      <Card>
        <CardHeader>
          <div className="font-semibold">Thông tin mô tả</div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div><span className="text-slate-600">Mô tả:</span> {doc.description ?? "-"}</div>
          <div><span className="text-slate-600">Thẻ:</span> {(doc.tags ?? []).join(", ") || "-"}</div>
          <div><span className="text-slate-600">Mức hiển thị:</span> {documentVisibilityLabel(doc.visibility)}</div>
          <div><span className="text-slate-600">Thành viên liên quan:</span> {memberRes.data?.full_name ?? "-"}</div>
          <div><span className="text-slate-600">Sự kiện liên quan:</span> {eventRes.data ? `${eventRes.data.title} (${formatDateVi(eventRes.data.event_date)})` : "-"}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="font-semibold">Tệp đã tải lên</div>
        </CardHeader>
        <CardContent>
          {!files || files.length === 0 ? (
            <p className="text-sm text-slate-600">Chưa có tệp nào được tải lên.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {files.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2">
                  <span>
                    {a.file_name} <span className="text-slate-500">({a.size_bytes} bytes)</span>
                  </span>
                  {signedUrls.get(a.id) ? (
                    <a className="text-xs underline" href={signedUrls.get(a.id)} target="_blank" rel="noreferrer">
                      Tải xuống
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
