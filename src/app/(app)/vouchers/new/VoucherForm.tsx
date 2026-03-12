"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { createVoucherAction } from "@/app/(app)/vouchers/actions";
import { voucherTypeEnum } from "@/lib/zod/voucher";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { voucherTypeLabel } from "@/lib/i18n/labels";
import type { AppRole } from "@/lib/db/types";
import { getRoleGuide } from "@/lib/access/role-capabilities";

type Fund = { id: string; name: string; currency: string };
type Category = { id: string; name: string; voucher_type: "INCOME" | "EXPENSE" };
type Member = { id: string; full_name: string };

function todayLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

export function VoucherForm({
  role,
  linkedMemberId,
  linkedMemberName,
}: {
  role: AppRole;
  linkedMemberId: string | null;
  linkedMemberName: string | null;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const roleGuide = getRoleGuide(role);
  const isMemberRole = role === "member";

  const [funds, setFunds] = useState<Fund[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [voucherType, setVoucherType] = useState<"INCOME" | "EXPENSE">(isMemberRole ? "EXPENSE" : "INCOME");
  const [fundId, setFundId] = useState("");
  const [categoryId, setCategoryId] = useState<string | "">("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [voucherDate, setVoucherDate] = useState(todayLocal());
  const [memberId, setMemberId] = useState<string>(linkedMemberId ?? "");
  const [householdLabel, setHouseholdLabel] = useState("");

  useEffect(() => {
    (async () => {
      const [f, c, m] = await Promise.all([
        supabase.from("funds").select("id,name,currency").eq("is_active", true).order("created_at", { ascending: true }),
        supabase.from("categories").select("id,name,voucher_type").order("name", { ascending: true }),
        supabase.from("members").select("id,full_name").order("full_name", { ascending: true }).limit(5000),
      ]);
      const fundRows = (f.data as Fund[]) ?? [];
      setFunds(fundRows);
      const firstFundId = fundRows[0]?.id;
      if (firstFundId) setFundId((current) => current || firstFundId);
      setCats((c.data as Category[]) ?? []);
      setMembers((m.data as Member[]) ?? []);
    })();
  }, [supabase]);

  const filteredCats = cats.filter((c) => c.voucher_type === voucherType);
  const linkedMemberDisplay = linkedMemberId ? members.find((item) => item.id === linkedMemberId)?.full_name ?? linkedMemberName ?? linkedMemberId : linkedMemberName;

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">{isMemberRole ? "Tạo đề nghị chi" : "Tạo phiếu mới"}</h1>
            <p className="text-sm text-slate-600">
              {isMemberRole
                ? "Thành viên chỉ được lập phiếu chi phục vụ việc chung. Sau khi hoàn tất, bạn gửi phiếu sang trạng thái chờ duyệt để người duyệt xử lý."
                : "Tạo phiếu thu hoặc chi, gắn với quỹ và người/hộ liên quan rồi chuyển sang bước duyệt theo quy trình tài chính."}
            </p>
          </div>
          <Button asChild variant="outline"><Link href="/vouchers">Quay lại</Link></Button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
          <div className="font-medium text-slate-900">{roleGuide.title}</div>
          <p className="mt-1 text-slate-600">{roleGuide.voucherSummary}</p>
          {isMemberRole ? (
            <ul className="mt-2 list-disc pl-5 text-slate-600">
              <li>Chỉ tạo được phiếu loại chi.</li>
              <li>Không được tự duyệt phiếu hoặc tạo phiếu điều chỉnh quỹ.</li>
              <li>Nên đính kèm hóa đơn/chứng từ sau khi tạo phiếu để người duyệt có đủ căn cứ.</li>
            </ul>
          ) : null}
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {[
            ["Bước 1", isMemberRole ? "Khai nội dung đề nghị chi" : "Khai thông tin phiếu", "Chọn quỹ, ngày hạch toán, tiêu đề và số tiền trước khi nghĩ tới duyệt."],
            ["Bước 2", "Gắn người hoặc hộ liên quan", "Nếu chi thay cho một thành viên hoặc hộ gia đình thì gắn ngay ở đây để báo cáo sau này rõ ràng."],
            ["Bước 3", "Lưu rồi bổ sung chứng từ", "Sau khi tạo xong, mở chi tiết phiếu để tải hóa đơn/chứng từ rồi mới gửi duyệt."],
          ].map(([step, title, body]) => (
            <div key={step} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
              <div className="text-xs uppercase tracking-wide text-slate-500">{step}</div>
              <div className="mt-1 font-medium text-slate-900">{title}</div>
              <p className="mt-2 text-slate-600">{body}</p>
            </div>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          <div className="grid gap-2 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Loại phiếu</Label>
              <select
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm disabled:opacity-50"
                value={voucherType}
                disabled={isMemberRole}
                onChange={(e) => {
                  const vt = voucherTypeEnum.parse(e.target.value);
                  setVoucherType(vt);
                  setCategoryId("");
                }}
              >
                <option value="INCOME">{voucherTypeLabel("INCOME")}</option>
                <option value="EXPENSE">{voucherTypeLabel("EXPENSE")}</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Ngày hạch toán</Label>
              <Input type="date" value={voucherDate} onChange={(e) => setVoucherDate(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Quỹ</Label>
              <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" value={fundId} onChange={(e) => setFundId(e.target.value)}>
                <option value="" disabled>-- chọn quỹ --</option>
                {funds.map((f) => <option key={f.id} value={f.id}>{f.name} ({f.currency})</option>)}
              </select>
              {funds.length === 0 ? <p className="text-xs text-slate-600">Chưa có quỹ đang hoạt động.</p> : null}
            </div>
            <div className="space-y-1">
              <Label>Danh mục</Label>
              <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">(không chọn)</option>
                {filteredCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Tiêu đề</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={isMemberRole ? "Ví dụ: Đề nghị mua đồ lễ / vật dụng chung" : "Ví dụ: Thu quỹ tháng 1"} />
          </div>

          <div className="space-y-1">
            <Label>Mô tả</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Nêu rõ mục đích, hoàn cảnh chi, số lượng và căn cứ đề nghị" />
          </div>

          <div className="grid gap-2 md:grid-cols-3">
            <div className="space-y-1">
              <Label>Số tiền</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label>Thành viên liên quan</Label>
              {isMemberRole && linkedMemberDisplay ? (
                <Input value={linkedMemberDisplay} disabled />
              ) : (
                <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" value={memberId} onChange={(e) => setMemberId(e.target.value)}>
                  <option value="">(không gắn)</option>
                  {members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}</select>
              )}
            </div>
            <div className="space-y-1">
              <Label>Hoặc hộ gia đình</Label>
              <Input value={householdLabel} onChange={(e) => setHouseholdLabel(e.target.value)} placeholder="Ví dụ: Hộ gia đình anh A" />
            </div>
          </div>

          {isMemberRole && !linkedMemberDisplay ? (
            <p className="text-xs text-amber-700">
              Tài khoản của bạn chưa gắn với hồ sơ thành viên trong cây. Bạn vẫn có thể gửi đề nghị chi theo hộ gia đình hoặc ghi rõ người liên quan trong mô tả.
            </p>
          ) : null}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <Button
            disabled={pending || !fundId}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const payload = {
                  fundId,
                  categoryId: categoryId || null,
                  voucherType: isMemberRole ? "EXPENSE" : voucherType,
                  title,
                  description: description || null,
                  amount,
                  voucherDate,
                  memberId: isMemberRole ? linkedMemberId : memberId || null,
                  householdLabel: householdLabel || null,
                } as const;
                const res = await createVoucherAction(payload);
                if (!res.ok) {
                  setError(res.error);
                  return;
                }
                router.push(`/vouchers/${res.id}?created=1`);
                router.refresh();
              });
            }}
          >
            {pending ? "Đang lưu..." : isMemberRole ? "Tạo đề nghị chi" : "Tạo phiếu"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
