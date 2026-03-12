"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createFundAction } from "@/app/(app)/funds/actions";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export function FundFormClient() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("VND");
  const [description, setDescription] = useState("");

  return (
    <div className="max-w-2xl">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold">Tạo quỹ mới</h1>
              <p className="text-sm text-slate-600">Tạo quỹ mới cho dòng họ</p>
            </div>
            <Button asChild variant="outline">
              <Link href="/funds">Quay lại</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>Tên quỹ</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ví dụ: Quỹ khuyến học" />
          </div>
          <div className="space-y-1">
            <Label>Tiền tệ</Label>
            <Input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
          </div>
          <div className="space-y-1">
            <Label>Mô tả</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Mục đích sử dụng quỹ" />
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button
            disabled={pending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const res = await createFundAction({ name, currency, description: description || null });
                if (!res.ok) {
                  setError(res.error);
                  return;
                }
                router.push("/funds?created=1");
                router.refresh();
              });
            }}
          >
            {pending ? "Đang lưu..." : "Tạo quỹ"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
