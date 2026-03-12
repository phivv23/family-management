"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import { registerAccountSchema } from "@/lib/zod/auth";
import { saveRegisterAccountDraft } from "@/lib/auth/register-draft";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Form = z.infer<typeof registerAccountSchema>;

export default function RegisterPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const nextUrl = searchParams.get("next") || "/onboarding";
  const emailHint = searchParams.get("email") || "";

  const [form, setForm] = useState<Form>({
    email: emailHint,
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (emailHint) {
      setForm((s) => ({ ...s, email: emailHint }));
    }
  }, [emailHint]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = registerAccountSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
      return;
    }

    saveRegisterAccountDraft({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    router.push(`/register/profile?next=${encodeURIComponent(nextUrl)}`);
  }

  return (
    <div className="grid min-h-[72vh] gap-6 lg:grid-cols-[1fr_1fr]">
      <Card className="hidden border-slate-200 bg-slate-50/80 lg:block">
        <CardContent className="flex h-full flex-col justify-between p-8">
          <div className="space-y-5">
            <div className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
              Bước 1/2 · Tạo tài khoản
            </div>
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
                Tách riêng phần tài khoản và hồ sơ để quy trình đăng ký rõ ràng hơn.
              </h1>
              <p className="max-w-xl text-sm leading-6 text-slate-600">
                Cách làm này sát với dự án thực tế hơn: người dùng tạo email và mật khẩu trước,
                sau đó mới khai hồ sơ cá nhân cơ bản để quản trị viên đối chiếu và liên kết vào đúng thành viên gia phả.
              </p>
            </div>
          </div>

          <div className="space-y-3 text-sm text-slate-600">
            <div className="rounded-2xl border border-white bg-white p-4 shadow-sm">
              <div className="font-semibold text-slate-900">1. Tạo tài khoản</div>
              <div className="mt-1">Khai email, mật khẩu và xác nhận lại mật khẩu.</div>
            </div>
            <div className="rounded-2xl border border-white bg-white p-4 shadow-sm">
              <div className="font-semibold text-slate-900">2. Khai hồ sơ cơ bản</div>
              <div className="mt-1">Bổ sung họ tên, giới tính, ngày sinh, quê quán, địa chỉ và ghi chú đối chiếu.</div>
            </div>
            <div className="rounded-2xl border border-white bg-white p-4 shadow-sm">
              <div className="font-semibold text-slate-900">3. Hoàn tất onboarding</div>
              <div className="mt-1">Sau khi đăng ký xong, bạn tạo dòng họ mới hoặc tham gia dòng họ qua lời mời.</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="space-y-3">
          <div className="inline-flex w-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
            Bước 1/2 · Tài khoản đăng nhập
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold tracking-tight">Tạo tài khoản</h2>
            <p className="text-sm text-slate-600">
              Nhập email và mật khẩu trước. Ở bước sau bạn sẽ khai hồ sơ cá nhân cơ bản riêng.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-1.5">
              <Label htmlFor="register-email">Email</Label>
              <Input
                id="register-email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
                placeholder="ban@example.com"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="register-password">Mật khẩu</Label>
                <Input
                  id="register-password"
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))}
                  placeholder="Tối thiểu 8 ký tự"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="register-password-confirm">Nhập lại mật khẩu</Label>
                <Input
                  id="register-password-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={form.confirmPassword}
                  onChange={(e) => setForm((s) => ({ ...s, confirmPassword: e.target.value }))}
                  placeholder="Nhập lại để xác nhận"
                />
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
              Mật khẩu chỉ dùng cho đăng nhập và không gộp chung với dữ liệu hồ sơ cá nhân. Đây là cách triển khai an toàn và sát thực tế hơn.
            </div>

            {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
            <Button className="h-11 w-full" type="submit">Tiếp tục tới bước khai hồ sơ</Button>

            <p className="text-sm text-slate-600">
              Đã có tài khoản?{" "}
              <Link
                className="font-medium text-slate-900 underline"
                href={`/login?next=${encodeURIComponent(nextUrl)}${emailHint ? `&email=${encodeURIComponent(emailHint)}` : ""}`}
              >
                Đăng nhập
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
