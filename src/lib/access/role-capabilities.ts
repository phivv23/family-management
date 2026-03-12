import type { AppRole } from "@/lib/db/types";

export type RoleCapability = {
  code: string;
  title: string;
  description: string;
};

export type RoleGuide = {
  role: AppRole;
  title: string;
  summary: string;
  voucherSummary: string;
  capabilities: RoleCapability[];
};

const ROLE_GUIDES: Record<AppRole, RoleGuide> = {
  admin: {
    role: "admin",
    title: "Quản trị viên hệ thống",
    summary: "Toàn quyền cấu hình dòng họ, người dùng, cây gia phả và nghiệp vụ tài chính. Đây là vai trò dự phòng cao nhất khi cần xử lý ngoại lệ.",
    voucherSummary: "Có thể tạo, gửi duyệt, duyệt, từ chối và điều chỉnh phiếu; vẫn phải tuân thủ nguyên tắc maker-checker, không tự duyệt phiếu do chính mình tạo.",
    capabilities: [
      { code: "family", title: "Quản trị dữ liệu gia phả", description: "Tạo, sửa, xóa thành viên; gắn cha, mẹ, con và vợ chồng; chuẩn hóa các mối quan hệ bị lệch." },
      { code: "users", title: "Quản trị tài khoản", description: "Mời người dùng, gắn tài khoản với hồ sơ thành viên và phân vai trò trong dòng họ." },
      { code: "finance", title: "Điều hành tài chính", description: "Tạo quỹ, lập phiếu, kiểm soát duyệt và xuất báo cáo tài chính." },
    ],
  },
  clan_manager: {
    role: "clan_manager",
    title: "Quản lý dòng họ",
    summary: "Điều phối hồ sơ, lời mời, sự kiện, tư liệu và theo dõi vận hành hằng ngày của dòng họ.",
    voucherSummary: "Có thể lập và gửi phiếu như bộ phận vận hành, nhưng phê duyệt tài chính vẫn nên do người duyệt hoặc admin xử lý để tách vai trò kiểm soát.",
    capabilities: [
      { code: "members", title: "Quản lý hồ sơ", description: "Tạo hồ sơ thành viên, liên kết quan hệ gia đình và hướng dẫn người dùng gắn tài khoản." },
      { code: "operations", title: "Điều phối hoạt động", description: "Tạo sự kiện, quản lý tài liệu, xử lý thông báo và lời mời tham gia." },
      { code: "finance", title: "Khởi tạo chứng từ", description: "Có thể lập phiếu và chuyển sang chờ duyệt, nhưng không phải vai trò phê duyệt chính." },
    ],
  },
  treasurer: {
    role: "treasurer",
    title: "Thủ quỹ",
    summary: "Quản lý quỹ, lập chứng từ và chuẩn bị hồ sơ thanh toán trước khi chuyển sang bước phê duyệt.",
    voucherSummary: "Lập phiếu thu/chi, cập nhật bản nháp, đính kèm chứng từ, gửi duyệt; không tự duyệt phiếu của mình.",
    capabilities: [
      { code: "funds", title: "Quản lý quỹ", description: "Theo dõi quỹ, danh mục và số liệu phục vụ thu chi." },
      { code: "maker", title: "Lập chứng từ", description: "Tạo bản nháp, đính kèm hóa đơn/chứng từ và chuyển phiếu sang chờ duyệt." },
      { code: "adjustment", title: "Điều chỉnh sau duyệt", description: "Tạo phiếu điều chỉnh khi chứng từ đã duyệt nhưng phát sinh sai lệch." },
    ],
  },
  approver: {
    role: "approver",
    title: "Người duyệt",
    summary: "Vai trò kiểm soát độc lập đối với các phiếu chờ duyệt. Người duyệt không phải là người lập chứng từ trong cùng vòng xử lý.",
    voucherSummary: "Xem phiếu chờ duyệt, đọc chứng từ đính kèm, phê duyệt hoặc từ chối kèm lý do. Không được duyệt phiếu do chính mình tạo.",
    capabilities: [
      { code: "review", title: "Kiểm tra hồ sơ", description: "Đọc nội dung chi tiêu, đối chiếu quỹ, người liên quan và chứng từ đính kèm." },
      { code: "approve", title: "Phê duyệt hoặc từ chối", description: "Ra quyết định cuối cho phiếu PENDING và lưu dấu vết thao tác trong nhật ký." },
      { code: "control", title: "Tách vai trò kiểm soát", description: "Không tham gia lập chứng từ trong cùng bước duyệt để giữ nguyên tắc maker-checker." },
    ],
  },
  member: {
    role: "member",
    title: "Thành viên thường",
    summary: "Sử dụng hệ thống để xem thông tin dòng họ, cập nhật hồ sơ cá nhân và gửi đề nghị chi tiêu phục vụ hoạt động chung.",
    voucherSummary: "Được tạo phiếu chi đề nghị, đính kèm chứng từ, tự gửi lên trạng thái chờ duyệt; không được duyệt, không được tạo phiếu thu hoặc điều chỉnh quỹ.",
    capabilities: [
      { code: "profile", title: "Sử dụng hồ sơ cá nhân", description: "Xem hồ sơ của mình, gửi đề xuất cập nhật và theo dõi trạng thái liên kết với cây gia phả." },
      { code: "expense", title: "Tạo đề nghị chi", description: "Lập phiếu chi phục vụ việc chung, mô tả rõ mục đích và đính kèm bằng chứng trước khi gửi duyệt." },
      { code: "tracking", title: "Theo dõi kết quả duyệt", description: "Xem phiếu của mình đang là bản nháp, chờ duyệt, đã duyệt hay bị từ chối." },
    ],
  },
};

export function getRoleGuide(role: AppRole): RoleGuide {
  return ROLE_GUIDES[role];
}

export function roleCanCreateVoucher(role: AppRole) {
  return ["admin", "clan_manager", "treasurer", "member"].includes(role);
}

export function roleCanApproveVoucher(role: AppRole) {
  return ["admin", "approver"].includes(role);
}

export function roleCanManageFamily(role: AppRole) {
  return ["admin", "clan_manager"].includes(role);
}
