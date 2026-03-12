"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { createClanAction } from "./actions";

function extractInviteToken(input: string) {
  const raw = input.trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    const parts = url.pathname.split("/").filter(Boolean);
    const joinIndex = parts.findIndex((part) => part === "join");
    if (joinIndex >= 0 && parts[joinIndex + 1]) return parts[joinIndex + 1];
  } catch {}
  return raw;
}

export function OnboardingForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [joinInput, setJoinInput] = useState("");
  const router = useRouter();

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <h1 className="text-xl font-semibold">Tạo dòng họ mới</h1>
          <p className="text-sm text-slate-600">Dùng khi bạn là người khởi tạo hệ thống cho một dòng họ hoàn toàn mới.</p>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            action={(fd) => {
              setError(null);
              startTransition(async () => {
                const res = await createClanAction(fd);
                if (!res.ok) setError(res.error);
                else router.replace("/dashboard");
              });
            }}
          >
            <div className="space-y-1">
              <Label>Tên dòng họ</Label>
              <Input name="clanName" placeholder="Ví dụ: Dòng họ Nguyễn" />
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <Button disabled={pending} type="submit" className="w-full">{pending ? "Đang tạo dòng họ..." : "Tạo dòng họ"}</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">Gia nhập dòng họ có sẵn</h2>
          <p className="text-sm text-slate-600">Nếu bạn đã được mời tham gia, hãy dán mã mời hoặc liên kết mời để xác nhận tham gia đúng dòng họ.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>Mã mời hoặc liên kết mời</Label>
            <Input value={joinInput} onChange={(e) => setJoinInput(e.target.value)} placeholder="Dán link /join/... hoặc mã token" />
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => {
              const token = extractInviteToken(joinInput);
              if (!token) {
                setError("Hãy nhập mã mời hoặc liên kết mời hợp lệ.");
                return;
              }
              router.push(`/join/${token}`);
            }}
          >
            Đi tới trang xác nhận lời mời
          </Button>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            Nếu quản trị viên đã thêm bạn vào dòng họ nhưng chưa gửi mã mời, bạn hãy nhờ họ vào mục <span className="font-medium">Người dùng &amp; hồ sơ</span> để tạo lời mời đúng email của bạn.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
