import Link from "next/link";
import { requireAuth } from "@/lib/auth/context";
import { createSupabaseServerComponentClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { voucherListQuerySchema } from "@/lib/zod/voucher-filters";
import { monthToRange } from "@/lib/zod/report";
import { formatMoney } from "@/lib/format/money";
import { formatDateVi, voucherStatusLabel, voucherTypeLabel } from "@/lib/i18n/labels";
import { getRoleGuide, roleCanCreateVoucher, roleCanApproveVoucher } from "@/lib/access/role-capabilities";
import { approveVoucherAction, submitVoucherAction } from "./actions";

function defaultMonth() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function CountPill({ count }: { count: number }) {
  return (
    <span className="inline-flex min-w-7 items-center justify-center rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
      {count}
    </span>
  );
}

export default async function VouchersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await requireAuth();
  const sp = await searchParams;

  const parsed = voucherListQuerySchema.safeParse({
    month: sp.month,
    fundId: sp.fundId,
    status: sp.status,
    type: sp.type,
  });

  const q = parsed.success ? parsed.data : {};
  const month = q.month ?? defaultMonth();
  const range = monthToRange(month);

  const supabase = await createSupabaseServerComponentClient();

  type FundRow = { id: string; name: string; currency: string };
  type VoucherRow = {
    id: string;
    title: string;
    status: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";
    voucher_type: "INCOME" | "EXPENSE";
    amount: number | string;
    voucher_date: string;
    fund_id: string | null;
    related_voucher_id: string | null;
    created_at: string;
    created_by: string | null;
    member_id: string | null;
    household_label: string | null;
  };

  let query = supabase
    .from("vouchers")
    .select("id,title,status,voucher_type,amount,voucher_date,fund_id,related_voucher_id,created_at,created_by,member_id,household_label")
    .eq("clan_id", ctx.activeClanId)
    .gte("voucher_date", range.from)
    .lt("voucher_date", range.to);

  if (q.fundId) query = query.eq("fund_id", q.fundId);
  if (q.status) query = query.eq("status", q.status);
  if (q.type) query = query.eq("voucher_type", q.type);

  const [{ data: funds }, { data: vouchers }, { data: members }] = await Promise.all([
    supabase
      .from("funds")
      .select("id,name,currency")
      .eq("clan_id", ctx.activeClanId)
      .order("created_at", { ascending: false })
      .limit(200)
      .returns<FundRow[]>(),
    query.order("created_at", { ascending: false }).limit(500).returns<VoucherRow[]>(),
    supabase.from("members").select("id,full_name").eq("clan_id", ctx.activeClanId).limit(5000),
  ]);

  const fundMap = new Map((funds ?? []).map((f) => [f.id, f]));
  const memberMap = new Map((members ?? []).map((m) => [m.id, m.full_name]));
  const defaultCurrency = funds?.[0]?.currency ?? "VND";

  const actorIds = Array.from(new Set((vouchers ?? []).map((item) => item.created_by).filter((v): v is string => Boolean(v))));
  const { data: actorProfiles } = actorIds.length > 0
    ? await supabase.from("profiles").select("user_id,full_name").in("user_id", actorIds)
    : { data: [] as Array<{ user_id: string; full_name: string | null }> };
  const actorMap = new Map((actorProfiles ?? []).map((item) => [item.user_id, item.full_name ?? item.user_id]));

  const canCreate = roleCanCreateVoucher(ctx.role);
  const canApprove = roleCanApproveVoucher(ctx.role);
  const roleGuide = getRoleGuide(ctx.role);

  const allVouchers = vouchers ?? [];
  const pendingQueue = allVouchers.filter((item) => item.status === "PENDING");
  const approvedItems = allVouchers.filter((item) => item.status === "APPROVED");
  const approvedIncome = approvedItems.filter((item) => item.voucher_type === "INCOME").reduce((sum, item) => sum + Number(item.amount), 0);
  const approvedExpense = approvedItems.filter((item) => item.voucher_type === "EXPENSE").reduce((sum, item) => sum + Number(item.amount), 0);
  const pendingAmount = pendingQueue.reduce((sum, item) => sum + Number(item.amount), 0);
  const myVouchers = allVouchers.filter((item) => item.created_by === ctx.userId);
  const myDrafts = myVouchers.filter((item) => item.status === "DRAFT");
  const myPending = myVouchers.filter((item) => item.status === "PENDING");
  const myRejected = myVouchers.filter((item) => item.status === "REJECTED");
  const actionablePending = pendingQueue.filter((item) => item.created_by !== ctx.userId);

  async function approveFromList(formData: FormData) {
    "use server";
    const voucherId = String(formData.get("voucherId") ?? "");
    if (!voucherId) return;
    await approveVoucherAction(voucherId);
  }

  async function submitFromList(formData: FormData) {
    "use server";
    const voucherId = String(formData.get("voucherId") ?? "");
    if (!voucherId) return;
    await submitVoucherAction(voucherId);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Phiếu thu chi"
        subtitle={roleGuide.title}
        right={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/dashboard">Tổng quan</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/reports/monthly">Báo cáo tháng</Link>
            </Button>
            {canCreate ? (
              <Button asChild>
                <Link href="/vouchers/new">{ctx.role === "member" ? "Tạo đề nghị chi" : "Tạo phiếu"}</Link>
              </Button>
            ) : null}
          </div>
        }
      />

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap gap-2 text-sm text-slate-600">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">{roleGuide.voucherSummary}</span>
            {canApprove ? <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-red-700">Không tự duyệt phiếu do chính mình tạo</span> : null}
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">Thu đã duyệt</div>
              <div className="mt-1 text-2xl font-semibold text-slate-900">{formatMoney(approvedIncome, defaultCurrency)}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">Chi đã duyệt</div>
              <div className="mt-1 text-2xl font-semibold text-slate-900">{formatMoney(approvedExpense, defaultCurrency)}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-2 text-xs uppercase tracking-wide text-slate-500">
                <span>Chờ duyệt</span>
                {pendingQueue.length > 0 ? <CountPill count={pendingQueue.length} /> : null}
              </div>
              <div className="mt-1 text-2xl font-semibold text-slate-900">{pendingQueue.length}</div>
              <div className="text-xs text-slate-500">{formatMoney(pendingAmount, defaultCurrency)}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">Bản nháp của bạn</div>
              <div className="mt-1 text-2xl font-semibold text-slate-900">{myDrafts.length}</div>
              <div className="text-xs text-slate-500">Gửi duyệt khi hồ sơ đã đủ chứng từ.</div>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">Công việc của bạn</div>
              <div className="mt-3 grid grid-cols-3 gap-3 text-center text-sm">
                <div className="rounded-xl bg-white p-3 shadow-sm">
                  <div className="text-slate-500">Nháp</div>
                  <div className="mt-1 text-xl font-semibold">{myDrafts.length}</div>
                </div>
                <div className="rounded-xl bg-white p-3 shadow-sm">
                  <div className="text-slate-500">Đã gửi</div>
                  <div className="mt-1 text-xl font-semibold">{myPending.length}</div>
                </div>
                <div className="rounded-xl bg-white p-3 shadow-sm">
                  <div className="text-slate-500">Bị từ chối</div>
                  <div className="mt-1 text-xl font-semibold">{myRejected.length}</div>
                </div>
              </div>
            </div>

            {canApprove ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold">Cần duyệt ngay</div>
                  {actionablePending.length > 0 ? <CountPill count={actionablePending.length} /> : null}
                </div>
                <div className="mt-2 text-sm">{actionablePending.length === 0 ? "Không có phiếu nào đang cần bạn ra quyết định." : "Mở từng phiếu để kiểm tra chứng từ hoặc dùng duyệt nhanh khi hồ sơ đã đủ."}</div>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                Theo dõi trạng thái phiếu của bạn theo các mốc: bản nháp → chờ duyệt → đã duyệt / từ chối.
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">Thao tác nhanh</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline"><Link href={`/vouchers?month=${month}`}>Giữ bộ lọc tháng</Link></Button>
                {canCreate ? (
                  <Button asChild size="sm"><Link href="/vouchers/new">{ctx.role === "member" ? "Tạo đề nghị chi" : "Tạo phiếu"}</Link></Button>
                ) : null}
              </div>
            </div>
          </div>

          <form className="flex flex-wrap items-end gap-2" action="/vouchers" method="get">
            <div className="space-y-1">
              <label className="text-xs text-slate-600">Tháng</label>
              <input
                name="month"
                defaultValue={month}
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
                placeholder="YYYY-MM"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-600">Quỹ</label>
              <select name="fundId" defaultValue={q.fundId ?? ""} className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm">
                <option value="">Tất cả</option>
                {(funds ?? []).map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-600">Trạng thái</label>
              <select name="status" defaultValue={q.status ?? ""} className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm">
                <option value="">Tất cả</option>
                <option value="DRAFT">Bản nháp</option>
                <option value="PENDING">Chờ duyệt</option>
                <option value="APPROVED">Đã duyệt</option>
                <option value="REJECTED">Từ chối</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-600">Loại phiếu</label>
              <select name="type" defaultValue={q.type ?? ""} className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm">
                <option value="">Tất cả</option>
                <option value="INCOME">Thu</option>
                <option value="EXPENSE">Chi</option>
              </select>
            </div>

            <Button type="submit" variant="outline">
              Lọc dữ liệu
            </Button>
          </form>
        </CardContent>
      </Card>

      {canApprove ? (
        <Card>
          <CardContent className="space-y-3 pt-6">
            <div className="flex items-center justify-between gap-3">
              <div className="text-lg font-semibold text-slate-900">Hàng chờ duyệt</div>
              {actionablePending.length > 0 ? <CountPill count={actionablePending.length} /> : null}
            </div>
            {pendingQueue.length === 0 ? (
              <p className="text-sm text-slate-600">Không có phiếu nào đang chờ duyệt trong tháng lọc.</p>
            ) : (
              <div className="space-y-3">
                {pendingQueue.map((item) => {
                  const creatorName = actorMap.get(item.created_by ?? "") ?? item.created_by ?? "-";
                  const relatedLabel = item.member_id ? memberMap.get(item.member_id) ?? item.member_id : item.household_label ?? "-";
                  const fund = item.fund_id ? fundMap.get(item.fund_id) : undefined;
                  const canQuickApprove = item.created_by !== ctx.userId;
                  return (
                    <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="space-y-1">
                          <Link href={`/vouchers/${item.id}`} className="text-base font-semibold underline">
                            {item.title}
                          </Link>
                          <div className="text-sm text-slate-600">{voucherTypeLabel(item.voucher_type)} · {formatMoney(Number(item.amount), fund?.currency ?? defaultCurrency)} · {formatDateVi(item.voucher_date)}</div>
                          <div className="text-xs text-slate-500">Người lập: {creatorName} · Đối tượng liên quan: {relatedLabel} · Quỹ: {fund?.name ?? "-"}</div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button asChild variant="outline"><Link href={`/vouchers/${item.id}`}>Mở chi tiết</Link></Button>
                          {canQuickApprove ? (
                            <form action={approveFromList}>
                              <input type="hidden" name="voucherId" value={item.id} />
                              <Button type="submit">Duyệt nhanh</Button>
                            </form>
                          ) : (
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">Phiếu này do bạn lập nên không được tự duyệt.</div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="pt-6">
          {!allVouchers || allVouchers.length === 0 ? (
            <p className="text-sm text-slate-600">Chưa có phiếu nào.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH>Ngày</TH>
                    <TH>Tiêu đề</TH>
                    <TH>Quỹ</TH>
                    <TH>Người/Hộ liên quan</TH>
                    <TH>Người lập</TH>
                    <TH>Loại</TH>
                    <TH>Trạng thái</TH>
                    <TH className="text-right">Số tiền</TH>
                    <TH>Điều chỉnh</TH>
                    <TH>Thao tác</TH>
                  </TR>
                </THead>
                <TBody>
                  {allVouchers.map((v) => {
                    const f = v.fund_id ? fundMap.get(v.fund_id) : undefined;
                    const cur = f?.currency ?? defaultCurrency;
                    const creatorName = actorMap.get(v.created_by ?? "") ?? v.created_by ?? "-";
                    const isOwner = v.created_by === ctx.userId;
                    const canQuickApprove = canApprove && v.status === "PENDING" && !isOwner;
                    const canQuickSubmit = canCreate && v.status === "DRAFT" && isOwner;
                    return (
                      <TR key={v.id}>
                        <TD className="whitespace-nowrap">{formatDateVi(v.voucher_date)}</TD>
                        <TD>
                          <Link className="truncate underline" href={`/vouchers/${v.id}`}>
                            {v.title}
                          </Link>
                        </TD>
                        <TD className="whitespace-nowrap">{f?.name ?? "-"}</TD>
                        <TD>{v.member_id ? memberMap.get(v.member_id) ?? v.member_id : v.household_label ?? "-"}</TD>
                        <TD className="whitespace-nowrap">{creatorName}</TD>
                        <TD className="whitespace-nowrap">{voucherTypeLabel(v.voucher_type)}</TD>
                        <TD className="whitespace-nowrap">{voucherStatusLabel(v.status)}</TD>
                        <TD className="text-right whitespace-nowrap">{formatMoney(Number(v.amount), cur)}</TD>
                        <TD>{v.related_voucher_id ? <Link href={`/vouchers/${v.related_voucher_id}`} className="underline">Phiếu gốc</Link> : "-"}</TD>
                        <TD>
                          <div className="flex flex-wrap gap-2">
                            <Button asChild size="sm" variant="outline"><Link href={`/vouchers/${v.id}`}>Mở</Link></Button>
                            {canQuickApprove ? (
                              <form action={approveFromList}>
                                <input type="hidden" name="voucherId" value={v.id} />
                                <Button type="submit" size="sm">Duyệt</Button>
                              </form>
                            ) : null}
                            {canQuickSubmit ? (
                              <form action={submitFromList}>
                                <input type="hidden" name="voucherId" value={v.id} />
                                <Button type="submit" size="sm">Gửi duyệt</Button>
                              </form>
                            ) : null}
                          </div>
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
