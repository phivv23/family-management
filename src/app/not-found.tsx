import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl items-center justify-center p-6">
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="text-4xl font-semibold text-slate-900">404</div>
        <div className="text-lg font-medium text-slate-800">Không tìm thấy nội dung bạn cần</div>
        <p className="text-sm text-slate-600">Dữ liệu có thể đã bị xóa, chưa thuộc dòng họ đang chọn, hoặc liên kết bạn mở không còn hợp lệ.</p>
        <div className="flex justify-center gap-2">
          <Button asChild variant="outline"><Link href="/dashboard">Về tổng quan</Link></Button>
          <Button asChild><Link href="/members">Mở danh sách thành viên</Link></Button>
        </div>
      </div>
    </div>
  );
}
