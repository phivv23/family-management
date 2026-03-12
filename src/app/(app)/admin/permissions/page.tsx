import Link from "next/link";
import { requireAuth, requireRole } from "@/lib/auth/context";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ROLE_ORDER, ROLE_MATRIX_ACTIONS, roleHasCapability } from "@/lib/access/role-matrix";
import { roleLabel } from "@/lib/i18n/labels";

function Cell({ ok, text }: { ok: boolean; text: string }) {
  return <span className={ok ? "text-emerald-700" : "text-slate-400"}>{ok ? text : "—"}</span>;
}

export default async function PermissionMatrixPage() {
  const ctx = await requireAuth();
  requireRole(ctx, ["admin", "clan_manager", "treasurer", "approver"]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Ma trận quyền & quy trình"
        subtitle="Bảng chuẩn hóa vai trò để biết ai được tạo, ai được sửa, ai được duyệt và ai chỉ được xem"
        right={
          <div className="flex gap-2">
            <Button asChild variant="outline"><Link href="/dashboard">Tổng quan</Link></Button>
            <Button asChild variant="outline"><Link href="/admin/action-logs">Nhật ký thao tác</Link></Button>
          </div>
        }
      />

      <Card>
        <CardHeader><div className="font-semibold">Quy tắc vận hành cốt lõi</div></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            ["Maker-checker", "Người lập phiếu không được tự duyệt phiếu do mình tạo; approver hoặc admin xử lý vòng duyệt."],
            ["Member chỉ tạo đề nghị chi", "Thành viên thường chỉ được tạo phiếu chi của chính mình, đính kèm chứng từ và gửi duyệt."],
            ["Gia phả tách khỏi tài khoản", "Hồ sơ thành viên là dữ liệu gia phả; tài khoản đăng nhập chỉ được gắn vào hồ sơ có sẵn hoặc tạo mới theo quy trình mời."],
            ["Quan hệ gia đình không chồng chéo", "Cha, mẹ, vợ/chồng, con được siết bằng điều kiện DB để không tạo vòng lặp hoặc vai trò trái giới tính."],
          ].map(([title, body]) => (
            <div key={title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <div className="font-medium text-slate-900">{title}</div>
              <p className="mt-2 text-slate-600">{body}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><div className="font-semibold">Bảng quyền theo vai trò</div></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <THead>
              <TR>
                <TH>Nghiệp vụ</TH>
                <TH>Mô tả</TH>
                {ROLE_ORDER.map((role) => <TH key={role}>{roleLabel(role)}</TH>)}
              </TR>
            </THead>
            <TBody>
              {ROLE_MATRIX_ACTIONS.map((action) => (
                <TR key={action.code}>
                  <TD className="whitespace-nowrap font-medium">{action.label}</TD>
                  <TD className="min-w-[320px] text-slate-600">{action.description}</TD>
                  {ROLE_ORDER.map((role) => (
                    <TD key={role} className="min-w-[160px] align-top text-sm">
                      <div className="space-y-1">
                        <div><Cell ok={roleHasCapability(role, action.create)} text="Tạo" /></div>
                        <div><Cell ok={roleHasCapability(role, action.update)} text="Sửa" /></div>
                        <div><Cell ok={roleHasCapability(role, action.approve)} text="Duyệt" /></div>
                        <div><Cell ok={roleHasCapability(role, action.view)} text="Xem" /></div>
                      </div>
                    </TD>
                  ))}
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
