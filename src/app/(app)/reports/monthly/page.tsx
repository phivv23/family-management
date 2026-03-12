import Link from "next/link";
import { requireAuth } from "@/lib/auth/context";
import { createSupabaseServerComponentClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatMoney } from "@/lib/format/money";
import { formatDateVi, voucherTypeLabel } from "@/lib/i18n/labels";
import { monthToRange } from "@/lib/zod/report";

export default async function MonthlyReportPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const ctx = await requireAuth();
  const { month } = await searchParams;

  const now = new Date();
  const defaultMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const ym = month && /^\d{4}-\d{2}$/.test(month) ? month : defaultMonth;

  const { from, to } = monthToRange(ym);

  const supabase = await createSupabaseServerComponentClient();
  const { data: funds } = await supabase.from("funds").select("id,name,currency").eq("clan_id", ctx.activeClanId);
  const fundMap = new Map((funds ?? []).map((f) => [f.id, f]));

  const { data: vouchers } = await supabase
    .from("vouchers")
    .select("id,title,voucher_type,amount,voucher_date,fund_id,status")
    .eq("clan_id", ctx.activeClanId)
    .eq("status", "APPROVED")
    .gte("voucher_date", from)
    .lt("voucher_date", to)
    .order("voucher_date", { ascending: true });

  const income = (vouchers ?? []).filter((v) => v.voucher_type === "INCOME").reduce((s, v) => s + Number(v.amount), 0);
  const expense = (vouchers ?? []).filter((v) => v.voucher_type === "EXPENSE").reduce((s, v) => s + Number(v.amount), 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Báo cáo tháng"
        subtitle={`Tháng ${ym} · Chỉ tính các phiếu đã duyệt`}
        right={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/dashboard">Tổng quan</Link>
            </Button>
            <Button asChild variant="outline">
              <a href={`/api/reports/monthly.csv?month=${ym}`} target="_blank" rel="noreferrer">
                Xuất CSV
              </a>
            </Button>
          </div>
        }
      />

      <Card>
        <CardContent className="space-y-3">
          <form method="get" action="/reports/monthly" className="flex items-center gap-2">
            <label className="text-sm text-slate-700">Tháng</label>
            <input name="month" defaultValue={ym} className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm" />
            <Button type="submit" variant="outline">
              Áp dụng
            </Button>
          </form>

          <div className="grid gap-2 md:grid-cols-3">
            <div className="rounded-md border border-slate-200 bg-white p-3">
              <div className="text-xs text-slate-600">Tổng thu</div>
              <div className="text-lg font-semibold">{formatMoney(income)}</div>
            </div>
            <div className="rounded-md border border-slate-200 bg-white p-3">
              <div className="text-xs text-slate-600">Tổng chi</div>
              <div className="text-lg font-semibold">{formatMoney(expense)}</div>
            </div>
            <div className="rounded-md border border-slate-200 bg-white p-3">
              <div className="text-xs text-slate-600">Chênh lệch</div>
              <div className="text-lg font-semibold">{formatMoney(income - expense)}</div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>Ngày</TH>
                  <TH>Tiêu đề</TH>
                  <TH>Quỹ</TH>
                  <TH>Loại</TH>
                  <TH className="text-right">Số tiền</TH>
                </TR>
              </THead>
              <TBody>
                {(vouchers ?? []).map((v) => {
                  const fund = fundMap.get(v.fund_id);
                  return (
                    <TR key={v.id}>
                      <TD className="whitespace-nowrap">{formatDateVi(v.voucher_date)}</TD>
                      <TD>
                        <Link className="underline" href={`/vouchers/${v.id}`}>
                          {v.title}
                        </Link>
                      </TD>
                      <TD className="whitespace-nowrap">{fund?.name ?? "-"}</TD>
                      <TD className="whitespace-nowrap">{voucherTypeLabel(v.voucher_type)}</TD>
                      <TD className="whitespace-nowrap text-right">{formatMoney(Number(v.amount), fund?.currency ?? "VND")}</TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
            {!vouchers || vouchers.length === 0 ? <div className="p-3 text-sm text-slate-600">Không có phiếu đã duyệt trong tháng này.</div> : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
