"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createAdjustmentVoucherAction } from "./actions";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export function AdjustmentForm({ originalVoucherId, defaultDate }: { originalVoucherId: string; defaultDate: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("Phiếu điều chỉnh");
  const [amount, setAmount] = useState<number>(0);
  const [voucherDate, setVoucherDate] = useState(defaultDate);
  const [description, setDescription] = useState("");

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <div className="font-semibold">Tạo phiếu điều chỉnh</div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <Label>Tiêu đề</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          <div className="space-y-1">
            <Label>Số tiền</Label>
            <Input type="number" value={String(amount)} onChange={(e) => setAmount(Number(e.target.value))} min={0} />
          </div>

          <div className="space-y-1">
            <Label>Ngày</Label>
            <Input type="date" value={voucherDate} onChange={(e) => setVoucherDate(e.target.value)} />
          </div>
        </div>

        <div className="space-y-1">
          <Label>Mô tả</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <Button
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const res = await createAdjustmentVoucherAction({
                originalVoucherId,
                title,
                amount,
                description: description || null,
                voucherDate,
              });
              if (!res.ok) {
                setError(res.error);
                return;
              }
              router.push("/vouchers?adjusted=1");
              router.refresh();
            });
          }}
        >
          {pending ? "Đang tạo..." : "Tạo phiếu nháp"}
        </Button>
      </CardContent>
    </Card>
  );
}
