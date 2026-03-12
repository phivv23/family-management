import Link from "next/link";
import { requireAuth } from "@/lib/auth/context";
import { createSupabaseServerComponentClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export default async function FundsPage() {
  const ctx = await requireAuth();
  const supabase = await createSupabaseServerComponentClient();
  const canCreate = ["admin","clan_manager","treasurer"].includes(ctx.role);

  const { data: funds } = await supabase.from("funds").select("id,name,currency,is_active").eq("clan_id", ctx.activeClanId).order("created_at", { ascending: true });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Các quỹ"
        subtitle="Quản lý quỹ"
        right={<div className="flex gap-2"><Button asChild variant="outline"><Link href="/dashboard">Tổng quan</Link></Button>{canCreate ? <Button asChild><Link href="/funds/new">Tạo quỹ</Link></Button> : null}</div>}
      />
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <THead><TR><TH>Tên quỹ</TH><TH>Tiền tệ</TH><TH>Active</TH></TR></THead>
            <TBody>
              {(funds ?? []).map((f) => (
                <TR key={f.id}>
                  <TD><Link className="underline" href={`/funds/${f.id}`}>{f.name}</Link></TD>
                  <TD className="whitespace-nowrap">{f.currency}</TD>
                  <TD className="whitespace-nowrap">{f.is_active ? "Có" : "Không"}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
          {(!funds || funds.length === 0) ? <div className="p-4 text-sm text-slate-600">Chưa có quỹ nào.</div> : null}
        </CardContent>
      </Card>
    </div>
  );
}
