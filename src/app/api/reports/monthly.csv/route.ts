import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/context";
import { monthToRange } from "@/lib/zod/report";

const querySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
});

export async function GET(req: Request) {
  const ctx = await requireAuth();

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({ month: url.searchParams.get("month") ?? "" });
  if (!parsed.success) {
    return new Response("Invalid month. Use YYYY-MM", { status: 400 });
  }

  const { from, to } = monthToRange(parsed.data.month);
  const supabase = await createSupabaseServerClient();

  const { data: rows, error } = await supabase
    .from("vouchers")
    .select("voucher_date,title,voucher_type,status,amount")
    .eq("clan_id", ctx.activeClanId)
    .eq("status", "APPROVED")
    .gte("voucher_date", from)
    .lt("voucher_date", to)
    .order("voucher_date", { ascending: true });

  if (error) return new Response(error.message, { status: 400 });

  const header = ["voucher_date", "title", "voucher_type", "status", "amount"];
  const lines: string[] = [header.join(",")];

  for (const r of rows ?? []) {
    const title = String(r.title).replaceAll('"', '""');
    lines.push(`${r.voucher_date},"${title}",${r.voucher_type},${r.status},${r.amount}`);
  }

  return new Response(lines.join("\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="monthly_${parsed.data.month}.csv"`,
    },
  });
}
