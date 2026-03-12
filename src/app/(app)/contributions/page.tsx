import Link from "next/link";
import { requireAuth } from "@/lib/auth/context";
import { createSupabaseServerComponentClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Button } from "@/components/ui/button";

export default async function ContributionsPage() {
  const ctx = await requireAuth();
  const supabase = await createSupabaseServerComponentClient();

  const [{ data: rows }, { data: members }, { data: funds }] = await Promise.all([
    supabase
      .from("vouchers")
      .select("id,title,amount,voucher_type,voucher_date,member_id,household_label")
      .eq("clan_id", ctx.activeClanId)
      .eq("status", "APPROVED")
      .order("voucher_date", { ascending: false })
      .limit(300),
    supabase.from("members").select("id,full_name").eq("clan_id", ctx.activeClanId).order("full_name", { ascending: true }).limit(5000),
    supabase.from("funds").select("currency").eq("clan_id", ctx.activeClanId).limit(1),
  ]);

  const memberMap = new Map((members ?? []).map((m) => [m.id, m.full_name]));
  const currency = funds?.[0]?.currency ?? "VND";
  const totalIncome = (rows ?? []).filter((r) => r.voucher_type === "INCOME").reduce((sum, r) => sum + Number(r.amount), 0);
  const totalExpense = (rows ?? []).filter((r) => r.voucher_type === "EXPENSE").reduce((sum, r) => sum + Number(r.amount), 0);

  const byPerson = new Map<string, number>();
  const byHousehold = new Map<string, number>();
  for (const row of rows ?? []) {
    if (row.member_id) byPerson.set(row.member_id, (byPerson.get(row.member_id) ?? 0) + Number(row.amount) * (row.voucher_type === "INCOME" ? 1 : -1));
    if (row.household_label) byHousehold.set(row.household_label, (byHousehold.get(row.household_label) ?? 0) + Number(row.amount) * (row.voucher_type === "INCOME" ? 1 : -1));
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Minh bạch đóng góp" subtitle="Tổng hợp các khoản đã duyệt theo người và theo hộ" right={<Button asChild><Link href="/vouchers/new">Tạo phiếu mới</Link></Button>} />

      <div className="grid gap-3 md:grid-cols-3">
        <Card><CardHeader><div className="text-xs text-slate-600">Tổng thu đã duyệt</div></CardHeader><CardContent><div className="text-2xl font-semibold">{totalIncome.toLocaleString("vi-VN")} {currency}</div></CardContent></Card>
        <Card><CardHeader><div className="text-xs text-slate-600">Tổng chi đã duyệt</div></CardHeader><CardContent><div className="text-2xl font-semibold">{totalExpense.toLocaleString("vi-VN")} {currency}</div></CardContent></Card>
        <Card><CardHeader><div className="text-xs text-slate-600">Chênh lệch</div></CardHeader><CardContent><div className="text-2xl font-semibold">{(totalIncome - totalExpense).toLocaleString("vi-VN")} {currency}</div></CardContent></Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader><div className="font-semibold">Theo thành viên</div></CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {[...byPerson.entries()].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).map(([memberId, amount]) => (
                <li key={memberId} className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white p-2">
                  <span>{memberMap.get(memberId) ?? memberId}</span>
                  <span>{amount.toLocaleString("vi-VN")} {currency}</span>
                </li>
              ))}
              {byPerson.size === 0 ? <li className="text-slate-600">Chưa có khoản nào gắn với thành viên.</li> : null}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><div className="font-semibold">Theo hộ gia đình</div></CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {[...byHousehold.entries()].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).map(([label, amount]) => (
                <li key={label} className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white p-2">
                  <span>{label}</span>
                  <span>{amount.toLocaleString("vi-VN")} {currency}</span>
                </li>
              ))}
              {byHousehold.size === 0 ? <li className="text-slate-600">Chưa có khoản nào gắn với hộ gia đình.</li> : null}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><div className="font-semibold">Danh sách chứng từ đã duyệt</div></CardHeader>
        <CardContent>
          <Table>
            <THead><TR><TH>Ngày</TH><TH>Tiêu đề</TH><TH>Loại</TH><TH>Người/Hộ</TH><TH>Số tiền</TH></TR></THead>
            <TBody>
              {(rows ?? []).map((row) => (
                <TR key={row.id}>
                  <TD>{row.voucher_date}</TD>
                  <TD><Link className="underline" href={`/vouchers/${row.id}`}>{row.title}</Link></TD>
                  <TD>{row.voucher_type}</TD>
                  <TD>{row.member_id ? memberMap.get(row.member_id) : row.household_label ?? "-"}</TD>
                  <TD>{Number(row.amount).toLocaleString("vi-VN")} {currency}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
