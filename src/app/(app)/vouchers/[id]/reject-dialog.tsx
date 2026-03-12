"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function RejectDialog({ onReject }: { onReject: (reason: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  if (!open) return <Button variant="outline" onClick={() => setOpen(true)}>Từ chối</Button>;

  return (
    <div className="flex items-center gap-2">
      <Input placeholder="Nhập lý do từ chối" value={reason} onChange={(e) => setReason(e.target.value)} />
      <Button disabled={pending} onClick={() => startTransition(async () => { await onReject(reason); setOpen(false); })}>
        {pending ? "Đang từ chối..." : "Xác nhận"}
      </Button>
      <Button variant="ghost" onClick={() => setOpen(false)}>Hủy</Button>
    </div>
  );
}
