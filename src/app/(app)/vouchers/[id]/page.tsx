import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/context";
import { createSupabaseServerComponentClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatMoney } from "@/lib/format/money";
import { UploadAttachment } from "@/components/attachments/UploadAttachment";
import { approveVoucherAction, rejectVoucherAction, submitVoucherAction } from "../actions";
import { getRoleGuide, roleCanApproveVoucher } from "@/lib/access/role-capabilities";
import { voucherStatusLabel, voucherTypeLabel } from "@/lib/i18n/labels";
import { RejectDialog } from "./reject-dialog";
import { assertSupabaseQuery } from "@/lib/supabase/assert";

type VoucherAttachmentRow = {
  created_at: string;
  attachments:
    | { id: string; bucket: string; object_path: string; file_name: string; size_bytes: number | string; created_at: string }
    | null;
};

export default async function VoucherDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireAuth();
  const supabase = await createSupabaseServerComponentClient();

  const voucherRes = await supabase
    .from("vouchers")
    .select("id,clan_id,fund_id,category_id,voucher_type,title,description,amount,voucher_date,status,related_voucher_id,created_by,created_at,member_id,household_label")
    .eq("id", id)
    .eq("clan_id", ctx.activeClanId)
    .maybeSingle();

  const voucher = assertSupabaseQuery("vouchers.detail", voucherRes.data, voucherRes.error);
  if (!voucher) return notFound();

  const [{ data: fund }, catRes, attachmentRes, adjustmentsRes, actionsRes, memberRes] = await Promise.all([
    supabase
      .from("funds")
      .select("id,name,currency")
      .eq("id", voucher.fund_id)
      .eq("clan_id", ctx.activeClanId)
      .maybeSingle(),
    voucher.category_id
      ? supabase.from("categories").select("id,name").eq("id", voucher.category_id).eq("clan_id", ctx.activeClanId).maybeSingle()
      : Promise.resolve({ data: null as { id: string; name: string } | null, error: null }),
    supabase
      .from("voucher_attachments")
      .select("created_at, attachments(id,bucket,object_path,file_name,size_bytes,created_at)")
      .eq("clan_id", ctx.activeClanId)
      .eq("voucher_id", id)
      .order("created_at", { ascending: false })
      .returns<VoucherAttachmentRow[]>(),
    supabase
      .from("vouchers")
      .select("id,title,status,amount,voucher_date")
      .eq("clan_id", ctx.activeClanId)
      .eq("related_voucher_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("voucher_actions")
      .select("id,action,created_by,note,created_at")
      .eq("clan_id", ctx.activeClanId)
      .eq("voucher_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    voucher.member_id
      ? supabase.from("members").select("id,full_name").eq("clan_id", ctx.activeClanId).eq("id", voucher.member_id).maybeSingle()
      : Promise.resolve({ data: null as { id: string; full_name: string } | null, error: null }),
  ]);
  const cat = catRes.data;
  const attachmentRows = attachmentRes.data;
  const adjustments = adjustmentsRes.data;
  const actions = actionsRes.data;
  const contributorMember = memberRes.data;
  const actorIds = Array.from(new Set([voucher.created_by, ...(actions ?? []).map((item) => item.created_by)].filter((v): v is string => Boolean(v))));
  const { data: actorProfiles } = actorIds.length > 0
    ? await supabase.from("profiles").select("user_id,full_name").in("user_id", actorIds)
    : { data: [] as Array<{ user_id: string; full_name: string | null }> };
  const actorMap = new Map((actorProfiles ?? []).map((item) => [item.user_id, item.full_name ?? item.user_id]));

  const atts = (attachmentRows ?? [])
    .map((r) => r.attachments)
    .filter((a): a is NonNullable<VoucherAttachmentRow["attachments"]> => Boolean(a));

  const signedUrlPairs = await Promise.all(
    (atts ?? []).map(async (a) => {
      const { data: signed } = await supabase.storage.from(a.bucket).createSignedUrl(a.object_path, 60);
      return signed?.signedUrl ? ([a.id, signed.signedUrl] as const) : null;
    })
  );
  const signedUrls = new Map<string, string>(signedUrlPairs.filter((x): x is readonly [string, string] => Boolean(x)));

  const isOwner = voucher.created_by === ctx.userId;
  const roleGuide = getRoleGuide(ctx.role);
  const canSubmit = ["treasurer", "admin", "clan_manager"].includes(ctx.role)
    ? voucher.status === "DRAFT"
    : ctx.role === "member"
      ? voucher.status === "DRAFT" && isOwner
      : false;
  const canAdjust = ["treasurer", "admin", "clan_manager"].includes(ctx.role) && voucher.status === "APPROVED";
  const canApproveReject = roleCanApproveVoucher(ctx.role) && voucher.status === "PENDING" && !isOwner;
  const canUploadAttachment = ["admin", "clan_manager", "treasurer"].includes(ctx.role) || (ctx.role === "member" && isOwner);

  async function submit() {
    "use server";
    await submitVoucherAction(id);
  }
  async function approve() {
    "use server";
    await approveVoucherAction(id);
  }
  async function reject(reason: string) {
    "use server";
    await rejectVoucherAction({ id, reason });
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={ctx.role === "member" ? "Chi tiết đề nghị chi" : "Chi tiết phiếu"}
        subtitle={`${voucherTypeLabel(voucher.voucher_type)} · ${voucherStatusLabel(voucher.status)} · ${voucher.voucher_date}`}
        right={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/vouchers">Quay lại</Link>
            </Button>
            {canSubmit ? (
              <form action={submit}>
                <Button type="submit">Gửi duyệt</Button>
              </form>
            ) : null}
            {canApproveReject ? (
              <form action={approve}>
                <Button type="submit">Duyệt</Button>
              </form>
            ) : null}
            {canApproveReject ? <RejectDialog onReject={reject} /> : null}
            {canAdjust ? (
              <Button asChild variant="outline">
                <Link href={`/vouchers/${voucher.id}/adjustment`}>Tạo phiếu điều chỉnh</Link>
              </Button>
            ) : null}
          </div>
        }
      />

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-lg font-semibold">{voucher.title}</div>
              <div className="text-sm text-slate-600">{voucher.description ?? "-"}</div>
              <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                {roleGuide.voucherSummary}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xl font-semibold">{formatMoney(Number(voucher.amount), fund?.currency ?? "VND")}</div>
              <Badge variant="outline">{fund?.name ?? "Quỹ"}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 text-sm md:grid-cols-2">
            <div>
              <span className="text-slate-500">Danh mục:</span> {cat?.name ?? "-"}
            </div>
            <div>
              <span className="text-slate-500">Trạng thái:</span> {voucherStatusLabel(voucher.status)}
            </div>
            <div>
              <span className="text-slate-500">Người đóng góp:</span> {contributorMember ? contributorMember.full_name : voucher.household_label ?? "-"}
            </div>
            <div>
              <span className="text-slate-500">Hộ gia đình:</span> {voucher.household_label ?? "-"}
            </div>
            <div>
              <span className="text-slate-500">Người tạo phiếu:</span> {isOwner ? "Chính bạn" : actorMap.get(voucher.created_by ?? "") ?? voucher.created_by}
            </div>
            <div>
              <span className="text-slate-500">Luồng xử lý:</span> {voucher.status === "DRAFT" ? "Đang chuẩn bị, chưa chuyển sang người duyệt" : voucher.status === "PENDING" ? "Đang chờ người duyệt xử lý" : voucher.status === "APPROVED" ? "Đã được duyệt và tính vào nghiệp vụ" : "Đã bị từ chối, có thể chỉnh và gửi lại"}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="text-xs uppercase tracking-wide text-slate-500">Người lập</div>
              <div className="mt-1 font-medium text-slate-900">{actorMap.get(voucher.created_by ?? "") ?? (isOwner ? "Chính bạn" : voucher.created_by ?? "-")}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="text-xs uppercase tracking-wide text-slate-500">Trạng thái hiện tại</div>
              <div className="mt-1 font-medium text-slate-900">{voucherStatusLabel(voucher.status)}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="text-xs uppercase tracking-wide text-slate-500">Nguyên tắc</div>
              <div className="mt-1 text-slate-700">Người duyệt phải khác người lập; mọi thao tác đều vào nhật ký và thông báo hệ thống.</div>
            </div>
          </div>

          {canApproveReject ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="font-semibold">Khối thao tác người duyệt</div>
                  <p className="mt-1 text-amber-900">Bạn đang xem một phiếu ở trạng thái chờ duyệt. Hãy kiểm tra quỹ, chứng từ, người liên quan và chỉ duyệt khi hồ sơ đã đầy đủ.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <form action={approve}>
                    <Button type="submit">Duyệt phiếu</Button>
                  </form>
                  <RejectDialog onReject={reject} />
                </div>
              </div>
            </div>
          ) : null}

          {voucher.status === "PENDING" && isOwner ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              Phiếu này đang chờ duyệt nhưng bạn cũng là người lập, nên hệ thống không hiển thị nút duyệt để giữ nguyên tắc maker-checker.
            </div>
          ) : null}

          <Separator />

          <div className="space-y-2">
            <div className="font-semibold">Tệp đính kèm</div>
            <UploadAttachment voucherId={id} clanId={ctx.activeClanId} canUpload={canUploadAttachment} />
            {!atts || atts.length === 0 ? (
              <p className="text-sm text-slate-600">Chưa có tệp đính kèm.</p>
            ) : (
              <ul className="text-sm list-disc pl-5">
                {atts.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2">
                    <span>
                      {a.file_name} <span className="text-slate-500">({a.size_bytes} bytes)</span>
                    </span>
                    {signedUrls.get(a.id) ? (
                      <a className="text-xs underline" href={signedUrls.get(a.id)} target="_blank" rel="noreferrer">
                        Tải xuống
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="font-semibold">Phiếu điều chỉnh</div>
            {!adjustments || adjustments.length === 0 ? (
              <p className="text-sm text-slate-600">Chưa có phiếu điều chỉnh.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {adjustments.map((adj) => (
                  <li key={adj.id} className="flex items-center justify-between gap-2">
                    <Link className="underline" href={`/vouchers/${adj.id}`}>
                      {adj.title}
                    </Link>
                    <span className="whitespace-nowrap">{adj.voucher_date} · {adj.status} · {formatMoney(Number(adj.amount), fund?.currency ?? "VND")}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="font-semibold">Nhật ký thao tác</div>
            {!actions || actions.length === 0 ? (
              <p className="text-sm text-slate-600">Chưa có nhật ký thao tác.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <THead>
                    <TR>
                      <TH>Thời gian</TH>
                      <TH>Hành động</TH>
                      <TH>Người thực hiện</TH>
                      <TH>Ghi chú</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {actions.map((ac) => (
                      <TR key={ac.id}>
                        <TD className="whitespace-nowrap">{ac.created_at}</TD>
                        <TD><Badge variant="outline">{ac.action}</Badge></TD>
                        <TD className="whitespace-nowrap">{ac.created_by ? actorMap.get(ac.created_by) ?? ac.created_by : "Hệ thống"}</TD>
                        <TD>{ac.note ? JSON.stringify(ac.note) : "-"}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
