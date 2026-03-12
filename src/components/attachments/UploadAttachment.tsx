"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { attachVoucherAction } from "@/app/(app)/vouchers/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
}

export function UploadAttachment({
  voucherId,
  clanId,
  canUpload,
}: {
  voucherId: string;
  clanId: string;
  canUpload: boolean;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onUpload() {
    setError(null);
    setSuccess(null);
    if (!file || !canUpload) return;
    setBusy(true);

    const objectPath = `${clanId}/vouchers/${voucherId}/${Date.now()}_${safeFileName(file.name)}`;
    const upload = await supabase.storage.from("clan-files").upload(objectPath, file, {
      upsert: false,
      contentType: file.type || "application/octet-stream",
    });

    if (upload.error) {
      setBusy(false);
      setError(upload.error.message);
      return;
    }

    const res = await attachVoucherAction({
      voucherId,
      bucket: "clan-files",
      objectPath,
      fileName: file.name,
      mimeType: file.type || null,
      sizeBytes: file.size,
    });

    if (!res.ok) {
      await supabase.storage.from("clan-files").remove([objectPath]);
      setBusy(false);
      setError(res.error);
      return;
    }

    setBusy(false);
    setFile(null);
    setSuccess("Đã tải chứng từ lên phiếu.");
    router.refresh();
  }

  if (!canUpload) {
    return <p className="text-sm text-slate-500">Bạn không có quyền tải chứng từ lên phiếu này.</p>;
  }

  return (
    <div className="space-y-2">
      <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-700">{success}</p> : null}
      <div>
        <Button disabled={busy || !file} onClick={onUpload}>
          {busy ? "Đang tải lên..." : "Tải chứng từ lên"}
        </Button>
      </div>
    </div>
  );
}
