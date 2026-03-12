"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createMemberAction } from "@/app/(app)/members/actions";
import { genderEnum } from "@/lib/zod/member";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export function MemberForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState<"MALE" | "FEMALE" | "OTHER" | "UNKNOWN">("UNKNOWN");
  const [dob, setDob] = useState<string>("");
  const [dod, setDod] = useState<string>("");
  const [bio, setBio] = useState("");

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Thêm thành viên mới</h1>
            <p className="text-sm text-slate-600">
              Tạo hồ sơ thành viên trước, sau đó mới liên kết cha mẹ, vợ chồng, con và tài khoản đăng nhập để cây gia phả ổn định.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/members">Quay lại</Link>
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {[
            ["Bước 1", "Nhập hồ sơ cơ bản", "Họ tên, giới tính, ngày sinh là tối thiểu để hệ thống biết cách xếp vai trò cha hoặc mẹ."],
            ["Bước 2", "Tạo hồ sơ", "Lưu hồ sơ trước để có mã thành viên và tránh tạo quan hệ khi dữ liệu chưa đầy đủ."],
            ["Bước 3", "Liên kết sau", "Sau khi tạo xong, mở trang chi tiết để gắn quan hệ gia đình và mời tài khoản nếu cần."],
          ].map(([step, title, body]) => (
            <div key={step} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <div className="text-xs uppercase tracking-wide text-slate-500">{step}</div>
              <div className="mt-1 font-medium text-slate-900">{title}</div>
              <p className="mt-2 text-slate-600">{body}</p>
            </div>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-1">
          <Label>Họ tên</Label>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ví dụ: Nguyễn Văn A" />
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          <div className="space-y-1">
            <Label>Giới tính</Label>
            <select
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={gender}
              onChange={(e) => setGender(genderEnum.parse(e.target.value))}
            >
              <option value="UNKNOWN">Chưa rõ</option>
              <option value="MALE">Nam</option>
              <option value="FEMALE">Nữ</option>
              <option value="OTHER">Khác</option>
            </select>
          </div>

          <div className="space-y-1">
            <Label>Ngày sinh</Label>
            <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
          </div>
        </div>

        <div className="space-y-1">
          <Label>Ngày mất (không bắt buộc)</Label>
          <Input type="date" value={dod} onChange={(e) => setDod(e.target.value)} />
        </div>

        <div className="space-y-1">
          <Label>Tiểu sử / ghi chú</Label>
          <Textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Ghi chú thêm về nghề nghiệp, đời thứ mấy, hoặc thông tin kiểm chứng để người quản trị đối chiếu"
          />
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Lưu ý: hồ sơ thành viên và tài khoản đăng nhập là hai lớp dữ liệu khác nhau. Không tạo lại hồ sơ nếu người này đã có trong cây; hãy dùng luồng mời tài khoản hoặc gắn tài khoản vào hồ sơ có sẵn.
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <Button
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const res = await createMemberAction({
                fullName,
                gender,
                dob: dob || null,
                dod: dod || null,
                bio: bio || null,
              });

              if (!res.ok) {
                setError(res.error);
                return;
              }

              router.push(`/members/${res.id}?created=1`);
              router.refresh();
            });
          }}
        >
          {pending ? "Đang lưu..." : "Tạo hồ sơ thành viên"}
        </Button>
      </CardContent>
    </Card>
  );
}
