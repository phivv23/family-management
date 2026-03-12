"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { reviewMemberUpdateRequestAction } from "./actions";
import { formatDateVi, updateRequestStatusLabel } from "@/lib/i18n/labels";

type Row = {
  id: string;
  member_id: string;
  member_name: string;
  payload: Record<string, unknown> | null;
  note: string | null;
  status: string;
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
};

export function UpdateRequestReviewClient({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [, startTransition] = useTransition();

  const review = (requestId: string, decision: "APPROVED" | "REJECTED") => {
    setError(null);
    setPendingId(requestId);
    startTransition(async () => {
      const res = await reviewMemberUpdateRequestAction({ requestId, decision, reviewNote: reviewNotes[requestId] || null });
      setPendingId(null);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {rows.length === 0 ? <p className="text-sm text-slate-600">Chưa có đề xuất nào.</p> : null}
      {rows.map((row) => (
        <div key={row.id} className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-medium">{row.member_name}</div>
            <div className="text-xs text-slate-500">{updateRequestStatusLabel(row.status)} · {formatDateVi(row.created_at)}</div>
          </div>
          <div className="mt-2 whitespace-pre-wrap text-slate-700">Ghi chú thành viên: {row.note ?? "-"}</div>
          <pre className="mt-2 overflow-x-auto rounded-md bg-slate-50 p-3 text-xs text-slate-700">{JSON.stringify(row.payload, null, 2)}</pre>
          <textarea
            className="mt-3 min-h-20 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            placeholder="Phản hồi của người duyệt"
            value={reviewNotes[row.id] ?? row.review_note ?? ""}
            onChange={(e) => setReviewNotes((prev) => ({ ...prev, [row.id]: e.target.value }))}
            disabled={row.status !== "PENDING"}
          />
          {row.status === "PENDING" ? (
            <div className="mt-3 flex gap-2">
              <Button variant="outline" disabled={pendingId === row.id} onClick={() => review(row.id, "REJECTED")}>Từ chối</Button>
              <Button disabled={pendingId === row.id} onClick={() => review(row.id, "APPROVED")}>Duyệt cập nhật</Button>
            </div>
          ) : (
            <div className="mt-2 text-xs text-slate-500">Đã xử lý {row.reviewed_at ? formatDateVi(row.reviewed_at) : ""}</div>
          )}
        </div>
      ))}
    </div>
  );
}
