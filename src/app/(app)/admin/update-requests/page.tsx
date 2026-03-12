import Link from "next/link";
import { requireAuth, requireRole } from "@/lib/auth/context";
import { createSupabaseServerComponentClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { UpdateRequestReviewClient } from "./ui";
import { Button } from "@/components/ui/button";

export default async function AdminUpdateRequestsPage() {
  const ctx = await requireAuth();
  requireRole(ctx, ["admin", "clan_manager"]);
  const supabase = await createSupabaseServerComponentClient();

  const [{ data: requests }, { data: members }] = await Promise.all([
    supabase
      .from("member_update_requests")
      .select("id,member_id,requested_by,payload,note,status,review_note,created_at,reviewed_at")
      .eq("clan_id", ctx.activeClanId)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("members").select("id,full_name").eq("clan_id", ctx.activeClanId).order("full_name", { ascending: true }).limit(5000),
  ]);

  const memberMap = new Map((members ?? []).map((m) => [m.id, m.full_name]));
  const rows = (requests ?? []).map((r) => ({ ...r, member_name: memberMap.get(r.member_id) ?? r.member_id }));

  return (
    <div className="space-y-4">
      <PageHeader title="Duyệt đề xuất cập nhật hồ sơ" subtitle="Workflow để thành viên đề xuất, ban quản lý xét duyệt" right={<Button asChild variant="outline"><Link href="/admin/users-roles">Tài khoản & phân quyền</Link></Button>} />
      <Card>
        <CardHeader><div className="font-semibold">Danh sách đề xuất</div></CardHeader>
        <CardContent>
          <UpdateRequestReviewClient rows={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
