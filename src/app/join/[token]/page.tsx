import Link from "next/link";
import { createSupabaseServerComponentClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { acceptInvitationAction } from "./actions";

export default async function JoinInvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createSupabaseServerComponentClient();

  const [{ data: previewData }, { data: userData }] = await Promise.all([
    supabase.rpc("preview_clan_invitation", { p_token: token }),
    supabase.auth.getUser(),
  ]);

  const preview = Array.isArray(previewData) ? previewData[0] : null;
  const user = userData?.user ?? null;
  const userEmail = (user?.email ?? "").toLowerCase();
  const inviteEmail = (preview?.email ?? "").toLowerCase();
  const nextTarget = `/join/${token}`;

  if (!preview) {
    return (
      <div className="mx-auto max-w-xl p-6">
        <Card>
          <CardHeader><h1 className="text-xl font-semibold">Lời mời không tồn tại</h1></CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            <p>Liên kết mời này không hợp lệ hoặc đã bị xóa.</p>
            <Button asChild><Link href="/login">Quay lại đăng nhập</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <Card>
        <CardHeader>
          <h1 className="text-xl font-semibold">Xác nhận tham gia dòng họ</h1>
          <p className="text-sm text-slate-600">Lời mời này được gắn với đúng email và có thể đi kèm hồ sơ thành viên đã chỉ định sẵn.</p>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
            <div><span className="text-slate-500">Dòng họ:</span> {preview.clan_name}</div>
            <div><span className="text-slate-500">Email được mời:</span> {preview.email}</div>
            <div><span className="text-slate-500">Vai trò:</span> {preview.role}</div>
            <div><span className="text-slate-500">Hết hạn:</span> {new Date(preview.expires_at).toLocaleDateString("vi-VN")}</div>
            <div className="md:col-span-2"><span className="text-slate-500">Hồ sơ thành viên gắn sẵn:</span> {preview.member_name ?? "Chưa gắn sẵn"}</div>
            <div className="md:col-span-2"><span className="text-slate-500">Ghi chú:</span> {preview.note ?? "-"}</div>
            <div className="md:col-span-2"><span className="text-slate-500">Trạng thái:</span> {preview.status}</div>
          </div>

          {preview.status !== "PENDING" ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-800">
              Lời mời này hiện không còn ở trạng thái chờ xác nhận. Bạn hãy liên hệ quản trị viên để được tạo lời mời mới.
            </div>
          ) : !user ? (
            <div className="space-y-3">
              <div className="rounded-md border border-slate-200 bg-white p-3 text-slate-700">
                Bạn cần đăng nhập hoặc đăng ký bằng đúng email <span className="font-medium">{preview.email}</span> rồi quay lại trang này để xác nhận tham gia.
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild><Link href={`/login?next=${encodeURIComponent(nextTarget)}&email=${encodeURIComponent(preview.email)}`}>Đăng nhập đúng email</Link></Button>
                <Button asChild variant="outline"><Link href={`/register?next=${encodeURIComponent(nextTarget)}&email=${encodeURIComponent(preview.email)}`}>Đăng ký tài khoản mới</Link></Button>
              </div>
            </div>
          ) : userEmail !== inviteEmail ? (
            <div className="space-y-3">
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-red-700">
                Bạn đang đăng nhập bằng <span className="font-medium">{user.email}</span>, nhưng lời mời này dành cho <span className="font-medium">{preview.email}</span>.
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline"><Link href="/logout">Đăng xuất tài khoản hiện tại</Link></Button>
                <Button asChild><Link href={`/login?next=${encodeURIComponent(nextTarget)}&email=${encodeURIComponent(preview.email)}`}>Đăng nhập đúng email</Link></Button>
              </div>
            </div>
          ) : (
            <form action={async () => { "use server"; await acceptInvitationAction(token); }} className="space-y-3">
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-emerald-800">
                Bạn đang đăng nhập đúng email được mời. Sau khi xác nhận, tài khoản sẽ được thêm vào dòng họ và gắn với hồ sơ đã chỉ định nếu có.
              </div>
              <Button type="submit">Xác nhận tham gia</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
