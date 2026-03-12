import Link from "next/link";
import { requireAuth } from "@/lib/auth/context";
import { createSupabaseServerComponentClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDateVi, genderLabel, roleLabel } from "@/lib/i18n/labels";
import { assertSupabaseQuery } from "@/lib/supabase/assert";

type AdminAccountRow = {
  user_id: string;
  email: string;
  full_name: string | null;
  role: string;
  member_id: string | null;
  linked_member_name: string | null;
};

type MemberLinkingRow = {
  member_id: string;
  member_name: string;
  linked_user_id: string | null;
  linked_email: string | null;
  linked_account_name: string | null;
  pending_invitation_id: string | null;
  pending_invitation_email: string | null;
  pending_invitation_expires_at: string | null;
};

export default async function MembersPage({ searchParams }: { searchParams: Promise<{ q?: string; created?: string }> }) {
  const ctx = await requireAuth();
  const { q, created } = await searchParams;
  const supabase = await createSupabaseServerComponentClient();

  let query = supabase
    .from("members")
    .select("id,full_name,gender,dob,dod,created_at")
    .eq("clan_id", ctx.activeClanId)
    .order("full_name", { ascending: true })
    .limit(500);

  if (q && q.trim().length > 0) query = query.ilike("full_name", `%${q.trim()}%`);

  const canManage = ctx.role === "admin" || ctx.role === "clan_manager";
  const [membersRes, linkedRes, memberLinkRes] = await Promise.all([
    query,
    canManage ? supabase.rpc("get_clan_members_admin") : Promise.resolve({ data: null, error: null }),
    canManage ? supabase.rpc("get_member_linking_admin") : Promise.resolve({ data: null, error: null }),
  ]);

  const members = assertSupabaseQuery("members.list", membersRes.data ?? [], membersRes.error);
  if (linkedRes.error) {
    console.error("members.list.get_clan_members_admin failed", linkedRes.error);
  }
  const accountRows = ((linkedRes.data ?? []) as AdminAccountRow[]);
  const memberLinkRows = ((memberLinkRes.data ?? []) as MemberLinkingRow[]);
  const linkedMap = new Map<string, MemberLinkingRow>();
  for (const row of memberLinkRows) linkedMap.set(row.member_id, row);
  const unlinkedAccounts = canManage ? accountRows.filter((row) => !row.member_id) : [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Thành viên"
        subtitle="Danh sách hồ sơ thành viên, trạng thái liên kết tài khoản và những tài khoản còn thiếu hồ sơ gia phả"
        right={
          <div className="flex gap-2">
            <Button asChild variant="outline"><Link href="/members/tree">Xem cây gia phả</Link></Button>
            {canManage ? <Button asChild><Link href="/members/new">Thêm thành viên</Link></Button> : null}
          </div>
        }
      />

      {created === "1" ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          Đã tạo hồ sơ thành viên thành công. Danh sách bên dưới đang tự lọc theo tên bạn vừa nhập để dễ kiểm tra.
        </div>
      ) : null}

      <Card>
        <CardContent className="space-y-3">
          <form className="flex gap-2" action="/members" method="get">
            <Input name="q" defaultValue={q ?? ""} placeholder="Tìm theo họ tên..." />
            <Button type="submit" variant="outline">Tìm kiếm</Button>
          </form>

          {!members || members.length === 0 ? (
            <p className="text-sm text-slate-600">Chưa có thành viên phù hợp với bộ lọc hiện tại.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  {canManage ? <TR><TH>Họ tên</TH><TH>Giới tính</TH><TH>Ngày sinh</TH><TH>Ngày mất</TH><TH>Liên kết tài khoản</TH><TH>Thao tác</TH></TR> : <TR><TH>Họ tên</TH><TH>Giới tính</TH><TH>Ngày sinh</TH><TH>Ngày mất</TH><TH>Liên kết tài khoản</TH></TR>}
                </THead>
                <TBody>
                  {members.map((m) => {
                    const linked = linkedMap.get(m.id);
                    return (
                      <TR key={m.id}>
                        <TD><Link className="underline" href={`/members/${m.id}`}>{m.full_name}</Link></TD>
                        <TD className="whitespace-nowrap">{genderLabel(m.gender)}</TD>
                        <TD className="whitespace-nowrap">{formatDateVi(m.dob)}</TD>
                        <TD className="whitespace-nowrap">{formatDateVi(m.dod)}</TD>
                        <TD className="whitespace-nowrap text-sm">
                          {linked?.linked_user_id ? (
                            <div className="space-y-0.5">
                              <div className="font-medium text-slate-900">Đã liên kết</div>
                              {canManage ? <div className="text-xs text-slate-500">{linked.linked_account_name || linked.linked_email}</div> : null}
                            </div>
                          ) : linked?.pending_invitation_id ? (
                            <div className="space-y-0.5">
                              <div className="font-medium text-amber-700">Đang chờ cấp tài khoản</div>
                              {canManage ? <div className="text-xs text-slate-500">{linked.pending_invitation_email} · hết hạn {formatDateVi(linked.pending_invitation_expires_at)}</div> : null}
                            </div>
                          ) : (
                            <span className="text-slate-500">Chưa liên kết</span>
                          )}
                        </TD>
                        {canManage ? (
                          <TD className="whitespace-nowrap">
                            {linked?.linked_user_id ? (
                              <Link href="/admin/users-roles" className="text-sm underline">Quản lý liên kết</Link>
                            ) : (
                              <Link href={`/admin/users-roles?memberId=${m.id}`} className="text-sm underline">Mời / gắn tài khoản</Link>
                            )}
                          </TD>
                        ) : null}
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {canManage ? (
        <Card>
          <CardHeader>
            <div className="font-semibold">Tài khoản đã tham gia nhưng chưa có hồ sơ thành viên</div>
            <p className="text-sm text-slate-600">Những tài khoản này chưa xuất hiện trong cây gia phả. Hãy tạo hoặc gắn hồ sơ cho họ tại mục Người dùng &amp; hồ sơ.</p>
          </CardHeader>
          <CardContent>
            {unlinkedAccounts.length === 0 ? (
              <p className="text-sm text-slate-500">Không có tài khoản nào đang chờ gắn hồ sơ.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <THead>
                    <TR><TH>Email</TH><TH>Tên hiển thị</TH><TH>Vai trò</TH><TH>Hành động</TH></TR>
                  </THead>
                  <TBody>
                    {unlinkedAccounts.map((row) => (
                      <TR key={row.user_id}>
                        <TD>{row.email}</TD>
                        <TD>{row.full_name || "-"}</TD>
                        <TD>{roleLabel(row.role)}</TD>
                        <TD><Link href="/admin/users-roles" className="text-sm underline">Tạo hoặc gắn hồ sơ ngay</Link></TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
