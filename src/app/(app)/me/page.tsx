import Link from "next/link";
import { requireAuth } from "@/lib/auth/context";
import { createSupabaseServerComponentClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { extractPendingMemberProfile } from "@/lib/member-profile";
import { genderLabel } from "@/lib/i18n/labels";
import { MeRequestForm } from "./request-form";

function requestStatusLabel(value: string) {
  switch (value) {
    case "PENDING":
      return "Đang chờ";
    case "APPROVED":
      return "Đã duyệt";
    case "REJECTED":
      return "Từ chối";
    default:
      return value;
  }
}

export default async function MePage() {
  const ctx = await requireAuth();
  const supabase = await createSupabaseServerComponentClient();
  const { data: userData } = await supabase.auth.getUser();
  const registrationProfile = extractPendingMemberProfile(userData?.user);
  const profileBasic = (
    await supabase
      .from("profiles")
      .select("full_name,avatar_url,gender,dob,phone,hometown,address,bio")
      .eq("user_id", ctx.userId)
      .maybeSingle()
  ).data;

  const canManageProfile = ctx.role === "admin" || ctx.role === "clan_manager";
  const linkedMemberId = ctx.linkedMemberId;

  const member = linkedMemberId
    ? (
        await supabase
          .from("members")
          .select("id,full_name,gender,dob,dod,bio")
          .eq("clan_id", ctx.activeClanId)
          .eq("id", linkedMemberId)
          .maybeSingle()
      ).data
    : null;

  const requests = linkedMemberId
    ? (
        await supabase
          .from("member_update_requests")
          .select("id,status,note,review_note,created_at,reviewed_at")
          .eq("clan_id", ctx.activeClanId)
          .eq("member_id", linkedMemberId)
          .order("created_at", { ascending: false })
          .limit(20)
      ).data ?? []
    : [];

  const [
    { data: parentEdges },
    { data: childEdges },
    { data: spouseEdges },
    { data: docs },
    { data: approvedVouchers },
  ] = linkedMemberId
    ? await Promise.all([
        supabase
          .from("member_parent_child")
          .select("parent_id")
          .eq("clan_id", ctx.activeClanId)
          .eq("child_id", linkedMemberId),
        supabase
          .from("member_parent_child")
          .select("child_id")
          .eq("clan_id", ctx.activeClanId)
          .eq("parent_id", linkedMemberId),
        supabase
          .from("member_spouses")
          .select("member_a_id,member_b_id")
          .eq("clan_id", ctx.activeClanId)
          .or(`member_a_id.eq.${linkedMemberId},member_b_id.eq.${linkedMemberId}`),
        supabase
          .from("documents")
          .select("id,title,doc_type,created_at")
          .eq("clan_id", ctx.activeClanId)
          .eq("member_id", linkedMemberId)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("vouchers")
          .select("id,amount,voucher_type,voucher_date,title")
          .eq("clan_id", ctx.activeClanId)
          .eq("status", "APPROVED")
          .eq("member_id", linkedMemberId)
          .order("voucher_date", { ascending: false })
          .limit(10),
      ])
    : [
        { data: [] as Array<{ parent_id: string }> },
        { data: [] as Array<{ child_id: string }> },
        { data: [] as Array<{ member_a_id: string; member_b_id: string }> },
        { data: [] as Array<{ id: string; title: string; doc_type: string; created_at: string }> },
        {
          data: [] as Array<{
            id: string;
            amount: number | string;
            voucher_type: string;
            voucher_date: string;
            title: string;
          }>,
        },
      ];

  const relatedIds = new Set<string>();
  for (const row of parentEdges ?? []) relatedIds.add(row.parent_id);
  for (const row of childEdges ?? []) relatedIds.add(row.child_id);
  for (const row of spouseEdges ?? []) {
    if (row.member_a_id === linkedMemberId) relatedIds.add(row.member_b_id);
    if (row.member_b_id === linkedMemberId) relatedIds.add(row.member_a_id);
  }

  const relatedMembers =
    relatedIds.size > 0
      ? (
          await supabase
            .from("members")
            .select("id,full_name,gender")
            .eq("clan_id", ctx.activeClanId)
            .in("id", [...relatedIds])
        ).data ?? []
      : [];

  const totalContribution = (approvedVouchers ?? []).reduce(
    (sum, item) => sum + Number(item.amount),
    0
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Hồ sơ của tôi"
        subtitle="Thông tin tài khoản và hồ sơ gia phả đã được quản trị viên xác nhận"
        right={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/members/tree">Cây gia phả</Link>
            </Button>

            {linkedMemberId ? (
              <Button asChild>
                <Link href={`/members/tree?highlight=${linkedMemberId}`}>Xem tôi trong cây</Link>
              </Button>
            ) : null}

            {canManageProfile && linkedMemberId ? (
              <Button asChild variant="outline">
                <Link href={`/members/${linkedMemberId}`}>Mở hồ sơ để chỉnh sửa</Link>
              </Button>
            ) : null}

            {canManageProfile && !linkedMemberId ? (
              <Button asChild variant="outline">
                <Link href="/admin/users-roles">Gắn hồ sơ cho tài khoản</Link>
              </Button>
            ) : null}
          </div>
        }
      />

      {!member ? (
        <>
          <Card>
            <CardContent className="space-y-3 p-4 text-sm text-slate-600">
              <div>
                Tài khoản này chưa được quản trị viên gắn với một thành viên trong gia phả.
                Sau khi được đối chiếu và gắn hồ sơ, bạn sẽ thấy đầy đủ vị trí của mình trong cây.
              </div>

              {canManageProfile ? (
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline">
                    <Link href="/admin/users-roles">Đi tới Người dùng & hồ sơ</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/members/new">Tạo hồ sơ thành viên mới</Link>
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {profileBasic?.full_name || registrationProfile ? (
            <Card>
              <CardHeader>
                <div className="font-semibold">Hồ sơ cá nhân cơ bản</div>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm md:grid-cols-2">
                <div>
                  <span className="text-slate-500">Họ tên:</span> {profileBasic?.full_name ?? registrationProfile?.fullName ?? "-"}
                </div>
                <div>
                  <span className="text-slate-500">Giới tính:</span>{" "}
                  {genderLabel((profileBasic?.gender as any) ?? registrationProfile?.gender ?? "UNKNOWN")}
                </div>
                <div>
                  <span className="text-slate-500">Ngày sinh:</span>{" "}
                  {profileBasic?.dob ?? registrationProfile?.dob ?? "-"}
                </div>
                <div>
                  <span className="text-slate-500">Số điện thoại:</span> {profileBasic?.phone ?? "-"}
                </div>
                <div>
                  <span className="text-slate-500">Quê quán:</span> {profileBasic?.hometown ?? "-"}
                </div>
                <div>
                  <span className="text-slate-500">Địa chỉ:</span> {profileBasic?.address ?? "-"}
                </div>
                <div className="md:col-span-2">
                  <span className="text-slate-500">Ghi chú:</span>{" "}
                  {profileBasic?.bio ?? registrationProfile?.bio ?? "-"}
                </div>
                <div className="md:col-span-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900">
                  Đây là hồ sơ cá nhân cơ bản của tài khoản. Quản trị viên sẽ dùng phần này để đối chiếu và gắn bạn vào đúng hồ sơ gia phả khi cần.
                </div>
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : (
        <>
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Hồ sơ này được quản trị viên quản lý để đảm bảo thống nhất dữ liệu gia phả.
            Nếu có thông tin sai, bạn có thể gửi yêu cầu chỉnh sửa ngay bên dưới để ban quản lý xét duyệt.
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold">Thông tin thành viên đã liên kết</div>
                  {canManageProfile ? (
                    <Button asChild variant="outline">
                      <Link href={`/members/${member.id}`}>Chỉnh sửa hồ sơ</Link>
                    </Button>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm md:grid-cols-2">
                <div>
                  <span className="text-slate-500">Họ tên:</span> {member.full_name}
                </div>
                <div>
                  <span className="text-slate-500">Giới tính:</span> {genderLabel(member.gender)}
                </div>
                <div>
                  <span className="text-slate-500">Ngày sinh:</span> {member.dob ?? "-"}
                </div>
                <div>
                  <span className="text-slate-500">Ngày mất:</span> {member.dod ?? "-"}
                </div>
                <div className="md:col-span-2">
                  <span className="text-slate-500">Tiểu sử:</span> {member.bio ?? "-"}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="font-semibold">Tóm tắt sử dụng thực tế</div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>
                  <span className="text-slate-500">Tài liệu liên quan:</span> {docs?.length ?? 0}
                </div>
                <div>
                  <span className="text-slate-500">Khoản đóng góp đã duyệt:</span>{" "}
                  {totalContribution.toLocaleString("vi-VN")} VND
                </div>
                <div>
                  <span className="text-slate-500">Lịch sử yêu cầu chỉnh sửa:</span>{" "}
                  {requests.length}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold">Yêu cầu chỉnh sửa hồ sơ thành viên</div>
                  <div className="mt-1 text-sm text-slate-600">
                    Gửi đề xuất khi thông tin trong hồ sơ gia phả chưa đúng. Ban quản lý sẽ xem xét trước khi cập nhật vào dữ liệu chính thức.
                  </div>
                </div>
                {canManageProfile ? (
                  <Button asChild variant="outline">
                    <Link href={`/members/${member.id}`}>Chỉnh sửa trực tiếp</Link>
                  </Button>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {canManageProfile ? (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-slate-700">
                  Tài khoản của bạn đang có quyền quản lý hồ sơ trong dòng họ này, nên có thể chỉnh sửa trực tiếp ở trang chi tiết thành viên. Phần yêu cầu chỉnh sửa được giữ cho các thành viên thường.
                </div>
              ) : (
                <>
                  <div className="rounded-md border border-sky-200 bg-sky-50 p-3 text-sky-900">
                    Bạn không sửa trực tiếp hồ sơ gia phả. Hãy điền thông tin muốn điều chỉnh và ghi rõ lý do hoặc nguồn đối chiếu để người duyệt xử lý nhanh hơn.
                  </div>
                  <MeRequestForm member={member} />
                </>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-3 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="font-semibold">Người thân gần trong cây</div>
              </CardHeader>
              <CardContent>
                {relatedMembers.length === 0 ? (
                  <p className="text-sm text-slate-600">Chưa có quan hệ nào được liên kết.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {relatedMembers.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white p-2"
                      >
                        <span>{item.full_name}</span>
                        <Link className="text-xs underline" href={`/members/${item.id}`}>
                          Xem hồ sơ
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="font-semibold">Lịch sử chỉnh sửa hồ sơ</div>
              </CardHeader>
              <CardContent>
                {requests.length === 0 ? (
                  <p className="text-sm text-slate-600">
                    Chưa có yêu cầu chỉnh sửa nào được ghi nhận.
                  </p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {requests.map((req) => (
                      <li
                        key={req.id}
                        className="rounded-md border border-slate-200 bg-white p-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{requestStatusLabel(req.status)}</span>
                          <span className="text-xs text-slate-500">
                            {new Date(req.created_at).toISOString().slice(0, 10)}
                          </span>
                        </div>
                        <div className="text-slate-600">
                          Nội dung ghi nhận: {req.note ?? "-"}
                        </div>
                        <div className="text-slate-600">
                          Phản hồi của quản trị viên: {req.review_note ?? "-"}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="font-semibold">Tư liệu liên quan</div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {docs && docs.length > 0 ? (
                  <ul className="space-y-1">
                    {docs.map((doc) => (
                      <li key={doc.id}>
                        <Link className="underline" href={`/documents/${doc.id}`}>
                          {doc.title}
                        </Link>{" "}
                        · {doc.doc_type}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-slate-600">Chưa có tài liệu liên quan.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="font-semibold">Khoản đóng góp gần đây</div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {approvedVouchers && approvedVouchers.length > 0 ? (
                  <ul className="space-y-1">
                    {approvedVouchers.map((v) => (
                      <li key={v.id}>
                        <Link className="underline" href={`/vouchers/${v.id}`}>
                          {v.title}
                        </Link>{" "}
                        · {Number(v.amount).toLocaleString("vi-VN")} VND · {v.voucher_date}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-slate-600">Chưa có khoản đóng góp nào.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}