import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/context";
import { createSupabaseServerComponentClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatMoney } from "@/lib/format/money";
import { assertSupabaseQuery } from "@/lib/supabase/assert";

export default async function FundDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAuth();
  const { id } = await params;

  const supabase = await createSupabaseServerComponentClient();

  const fundRes = await supabase
    .from("funds")
    .select("id,name,currency,is_active,created_at")
    .eq("id", id)
    .eq("clan_id", ctx.activeClanId)
    .maybeSingle();

  const fund = assertSupabaseQuery("funds.detail", fundRes.data, fundRes.error);
  if (!fund) return notFound();

  const { data: balance, error: balErr } = await supabase.rpc("compute_fund_balance", { p_fund_id: id });

  return (
    <div className="space-y-4">
      <PageHeader
        title={fund.name}
        subtitle={`Tiền tệ: ${fund.currency} · ${fund.is_active ? "Đang hoạt động" : "Ngừng sử dụng"}`}
        right={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/funds">Quay lại</Link>
            </Button>
            <Button asChild>
              <Link href="/vouchers/new">Tạo phiếu mới</Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="text-xs text-slate-600">Số dư đã duyệt</div>
          </CardHeader>
          <CardContent>
            {balErr ? (
              <p className="text-sm text-red-600">{balErr.message}</p>
            ) : (
              <div className="text-2xl font-semibold">{formatMoney(Number(balance ?? 0), fund.currency)}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="text-xs text-slate-600">Thông tin</div>
          </CardHeader>
          <CardContent className="text-sm text-slate-700 space-y-1">
            <div>
              <span className="text-slate-500">Mã quỹ:</span> {fund.id}
            </div>
            <div>
              <span className="text-slate-500">Ngày tạo:</span> {new Date(fund.created_at).toISOString()}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
