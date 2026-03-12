"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { attachDocumentFileAction, createDocumentAction, deleteDocumentAction } from "@/app/(app)/documents/actions";
import { documentTypeEnum } from "@/lib/zod/document";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
}

type Member = { id: string; full_name: string };
type EventLite = { id: string; title: string; event_date: string };

export function DocumentUploadForm({ clanId }: { clanId: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [pending, startTransition] = useTransition();

  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState<"PDF" | "IMAGE" | "OTHER">("OTHER");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [visibility, setVisibility] = useState<"CLAN" | "PUBLIC" | "MANAGER_ONLY">("CLAN");
  const [memberId, setMemberId] = useState("");
  const [eventId, setEventId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [events, setEvents] = useState<EventLite[]>([]);

  useEffect(() => {
    (async () => {
      const [m, e] = await Promise.all([
        supabase.from("members").select("id,full_name").order("full_name", { ascending: true }).limit(5000),
        supabase.from("events").select("id,title,event_date").order("event_date", { ascending: false }).limit(1000),
      ]);
      setMembers((m.data as Member[]) ?? []);
      setEvents((e.data as EventLite[]) ?? []);
    })();
  }, [supabase]);

  return (
    <div className="max-w-2xl">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold">Tải tư liệu lên</h1>
              <p className="text-sm text-slate-600">Tạo hồ sơ tài liệu và tải file lên kho lưu trữ số của dòng họ</p>
            </div>
            <Button asChild variant="outline">
              <Link href="/documents">Quay lại</Link>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>Tiêu đề tài liệu</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Loại tài liệu</Label>
              <select
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                value={docType}
                onChange={(e) => setDocType(documentTypeEnum.parse(e.target.value))}
              >
                <option value="PDF">PDF</option>
                <option value="IMAGE">Ảnh</option>
                <option value="OTHER">Khác</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Mức hiển thị</Label>
              <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" value={visibility} onChange={(e) => setVisibility(e.target.value as "CLAN" | "PUBLIC" | "MANAGER_ONLY") }>
                <option value="CLAN">Trong dòng họ</option>
                <option value="PUBLIC">Công khai</option>
                <option value="MANAGER_ONLY">Chỉ ban quản lý</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Mô tả</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Gắn với thành viên</Label>
              <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" value={memberId} onChange={(e) => setMemberId(e.target.value)}>
                <option value="">(không gắn)</option>
                {members.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Gắn với sự kiện</Label>
              <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" value={eventId} onChange={(e) => setEventId(e.target.value)}>
                <option value="">(không gắn)</option>
                {events.map((item) => <option key={item.id} value={item.id}>{item.title} ({item.event_date})</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Thẻ phân loại</Label>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Ví dụ: gia-pha, anh-cu, su-kien" />
          </div>

          <div className="space-y-1">
            <Label>Tệp tải lên</Label>
            <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <p className="text-xs text-slate-600">Bucket: clan-files (riêng tư) · Đường dẫn: {`{clanId}/documents/{documentId}/...`}</p>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <Button
            disabled={pending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                if (!file) {
                  setError("Vui lòng chọn tệp cần tải lên.");
                  return;
                }

                const created = await createDocumentAction({
                  title,
                  description: description || null,
                  docType,
                  tags: tags.split(",").map((x) => x.trim()).filter(Boolean),
                  memberId: memberId || null,
                  eventId: eventId || null,
                  visibility,
                });
                if (!created.ok) {
                  setError(created.error);
                  return;
                }

                const docId = created.id;
                const objectPath = `${clanId}/documents/${docId}/${Date.now()}_${safeFileName(file.name)}`;

                const uploadRes = await supabase.storage.from("clan-files").upload(objectPath, file, {
                  contentType: file.type || "application/octet-stream",
                  upsert: false,
                });

                if (uploadRes.error) {
                  await deleteDocumentAction(docId);
                  setError(uploadRes.error.message);
                  return;
                }

                const attachRes = await attachDocumentFileAction({
                  documentId: docId,
                  bucket: "clan-files",
                  objectPath,
                  fileName: file.name,
                  mimeType: file.type || null,
                  sizeBytes: file.size,
                });

                if (!attachRes.ok) {
                  await supabase.storage.from("clan-files").remove([objectPath]);
                  await deleteDocumentAction(docId);
                  setError(attachRes.error);
                  return;
                }

                router.push("/documents?uploaded=1");
                router.refresh();
              });
            }}
          >
            {pending ? "Đang tải lên..." : "Tạo hồ sơ và tải tệp"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
