import Link from "next/link";
import { requireAuth, requireRole } from "@/lib/auth/context";
import { AdjustmentForm } from "./ui";

export default async function VoucherAdjustmentPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAuth();
  requireRole(ctx, ["admin", "clan_manager", "treasurer"]);

  const { id } = await params;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Tạo phiếu điều chỉnh</h1>
          <p className="text-sm text-slate-600">Original voucher: {id}</p>
        </div>
        <Link className="underline text-sm" href={`/vouchers/${id}`}>
          Back
        </Link>
      </div>

      <AdjustmentForm originalVoucherId={id} defaultDate={new Date().toISOString().slice(0, 10)} />
    </div>
  );
}
