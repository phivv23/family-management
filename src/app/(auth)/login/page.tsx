"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { z } from "zod";
import { loginSchema } from "@/lib/zod/auth";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  loadRegisterProfileDraft,
} from "@/lib/auth/register-draft";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Form = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get("next") || "/dashboard";
  const emailHint = searchParams.get("email") || "";
  const shouldCompleteProfile = searchParams.get("complete") === "1";

  const [form, setForm] = useState<Form>({ email: emailHint, password: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (emailHint) {
      setForm((s) => ({ ...s, email: emailHint }));
    }
  }, [emailHint]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = loginSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
      return;
    }

    setBusy(true);
    const { data, error: err } = await supabase.auth.signInWithPassword(parsed.data);
    setBusy(false);

    if (err) {
      setError(err.message);
      return;
    }

    const pendingProfile = loadRegisterProfileDraft();
    if (shouldCompleteProfile && pendingProfile) {
      window.location.href = `/register/profile?complete=1&next=${encodeURIComponent(nextUrl)}`;
      return;
    }

    window.location.href = nextUrl;
  }

  return (
    <div className="grid min-h-[72vh] gap-6 lg:grid-cols-[1.05fr_0.95fr]">
      <Card className="hidden border-slate-200 bg-slate-50/80 lg:block">
        <CardContent className="flex h-full flex-col justify-between p-8">
          <div className="space-y-4">
            <div className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
              Cổng truy cập quản trị dòng họ
            </div>
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
                Đăng nhập để tiếp tục quản lý hồ sơ, quỹ và cây gia phả.
              </h1>
              <p className="max-w-xl text-sm leading-6 text-slate-600">
                Giao diện đăng nhập được giữ gọn, rõ và đi đúng quy trình thực tế:
                đăng nhập tài khoản trước, sau đó mới làm các bước quản trị hoặc hoàn thiện hồ sơ còn thiếu.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white bg-white p-4 shadow-sm">
              <div className="text-sm font-semibold text-slate-900">Bảo mật hơn</div>
              <div className="mt-2 text-sm text-slate-600">Tách riêng thông tin đăng nhập khỏi hồ sơ cá nhân.</div>
            </div>
            <div className="rounded-2xl border border-white bg-white p-4 shadow-sm">
              <div className="text-sm font-semibold text-slate-900">Dễ vận hành</div>
              <div className="mt-2 text-sm text-slate-600">Quản trị viên đối chiếu hồ sơ sau khi người dùng đăng nhập.</div>
            </div>
            <div className="rounded-2xl border border-white bg-white p-4 shadow-sm">
              <div className="text-sm font-semibold text-slate-900">Ít lỗi session</div>
              <div className="mt-2 text-sm text-slate-600">Không nhét hồ sơ chi tiết vào metadata đăng nhập.</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="space-y-3">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold tracking-tight">Đăng nhập</h2>
            <p className="text-sm text-slate-600">
              Dùng email và mật khẩu đã đăng ký để truy cập hệ thống quản lý dòng họ.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-1.5">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
                placeholder="ban@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="login-password">Mật khẩu</Label>
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={form.password}
                onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))}
                placeholder="Nhập mật khẩu"
              />
            </div>
            {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
            <Button disabled={busy} className="h-11 w-full" type="submit">
              {busy ? "Đang đăng nhập..." : "Đăng nhập"}
            </Button>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
              Nếu bạn vừa đăng ký và cần hoàn tất hồ sơ, hệ thống chỉ chuyển sang bước này khi có yêu cầu tiếp tục đăng ký rõ ràng.
            </div>
            <p className="text-sm text-slate-600">
              Chưa có tài khoản?{" "}
              <Link
                className="font-medium text-slate-900 underline"
                href={`/register?next=${encodeURIComponent(nextUrl)}${emailHint ? `&email=${encodeURIComponent(emailHint)}` : ""}`}
              >
                Bắt đầu đăng ký
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
