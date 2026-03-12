import Link from "next/link";
import { requireAuth, requireRole } from "@/lib/auth/context";
import { createSupabaseServerComponentClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AdminUsersClient } from "./users-client";

type RpcMemberRow = {
  user_id: string;
  email: string;
  full_name: string | null;
  role: string;
  member_id: string | null;
  linked_member_name: string | null;
  link_block_reason: string | null;
};

type InvitationRow = {
  id: string;
  email: string;
  role: string;
  member_id: string | null;
  status: string;
  expires_at: string;
  created_at: string;
  note: string | null;
  token: string;
};

type MemberLinkingRow = {
  member_id: string;
  member_name: string;
  gender: string;
  dob: string | null;
  linked_user_id: string | null;
  linked_email: string | null;
  linked_account_name: string | null;
  linked_role: string | null;
  pending_invitation_id: string | null;
  pending_invitation_email: string | null;
  pending_invitation_role: string | null;
  pending_invitation_expires_at: string | null;
  pending_invitation_token: string | null;
  pending_invitation_note: string | null;
};

export default async function AdminUsersRolesPage({
  searchParams,
}: {
  searchParams: Promise<{ memberId?: string }>;
}) {
  const ctx = await requireAuth();
  requireRole(ctx, ["admin", "clan_manager"]);
  const { memberId } = await searchParams;

  const supabase = await createSupabaseServerComponentClient();
  const [{ data: rows, error }, { data: allMembers }, { data: invites }, { data: memberLinkRows }] = await Promise.all([
    supabase.rpc("get_clan_members_admin"),
    supabase.from("members").select("id,full_name").eq("clan_id", ctx.activeClanId).order("full_name", { ascending: true }).limit(5000),
    supabase
      .from("clan_invitations")
      .select("id,email,role,member_id,status,expires_at,created_at,note,token")
      .eq("clan_id", ctx.activeClanId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.rpc("get_member_linking_admin"),
  ]);

  const members = ((rows ?? []) as RpcMemberRow[]).map((r) => ({
    user_id: r.user_id,
    email: r.email,
    full_name: r.full_name ?? "",
    role: r.role,
    member_id: r.member_id ?? null,
    linked_member_name: r.linked_member_name ?? null,
    link_block_reason: r.link_block_reason ?? null,
  }));

  const memberOptions = (allMembers ?? []).map((m) => ({ id: m.id as string, full_name: m.full_name as string }));
  const linkedMemberIds = new Set(members.map((m) => m.member_id).filter(Boolean) as string[]);
  const pendingInviteMemberIds = new Set(((invites ?? []) as InvitationRow[])
    .filter((i) => i.status === "PENDING" && i.member_id)
    .map((i) => i.member_id as string));
  const availableMembers = memberOptions.filter((m) => !linkedMemberIds.has(m.id) && !pendingInviteMemberIds.has(m.id));
  const memberNameById = new Map(memberOptions.map((m) => [m.id, m.full_name]));

  const invitationRows = ((invites ?? []) as InvitationRow[]).map((item) => ({
    ...item,
    linked_member_name: item.member_id ? memberNameById.get(item.member_id) ?? null : null,
  }));

  const memberLinking = ((memberLinkRows ?? []) as MemberLinkingRow[]).map((row) => ({
    member_id: row.member_id,
    member_name: row.member_name,
    gender: row.gender,
    dob: row.dob,
    linked_user_id: row.linked_user_id ?? null,
    linked_email: row.linked_email ?? null,
    linked_account_name: row.linked_account_name ?? null,
    linked_role: row.linked_role ?? null,
    pending_invitation_id: row.pending_invitation_id ?? null,
    pending_invitation_email: row.pending_invitation_email ?? null,
    pending_invitation_role: row.pending_invitation_role ?? null,
    pending_invitation_expires_at: row.pending_invitation_expires_at ?? null,
    pending_invitation_token: row.pending_invitation_token ?? null,
    pending_invitation_note: row.pending_invitation_note ?? null,
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Người dùng, lời mời và hồ sơ thành viên"
        subtitle="Mời người thân theo email/link và gắn tài khoản với đúng hồ sơ thành viên như một hệ thống quản lý hồ sơ thực tế"
        right={
          <div className="flex gap-2">
            <Button asChild variant="outline"><Link href="/dashboard">Tổng quan</Link></Button>
            <Button asChild variant="outline"><Link href="/admin/action-logs">Nhật ký thao tác</Link></Button>
            <Button asChild variant="outline"><Link href="/admin/update-requests">Duyệt cập nhật</Link></Button>
          </div>
        }
      />

      <Card>
        <CardHeader><div className="font-semibold">Lời mời tham gia và liên kết hồ sơ</div></CardHeader>
        <CardContent>
          {error ? (
            <p className="text-sm text-red-600">{error.message}</p>
          ) : (
            <AdminUsersClient
              members={members}
              clanMembers={memberOptions}
              availableMembers={availableMembers}
              invitations={invitationRows}
              currentUserId={ctx.userId}
              currentRole={ctx.role}
              memberLinking={memberLinking}
              preselectedMemberId={memberId ?? null}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
