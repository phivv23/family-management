import type { AppRole } from "@/lib/db/types";

export type RoleMatrixAction = {
  code: string;
  label: string;
  description: string;
  create: AppRole[];
  approve?: AppRole[];
  update?: AppRole[];
  view?: AppRole[];
};

export const ROLE_ORDER: AppRole[] = ["admin", "clan_manager", "treasurer", "approver", "member"];

export const ROLE_MATRIX_ACTIONS: RoleMatrixAction[] = [
  {
    code: "member_profile",
    label: "Hồ sơ thành viên",
    description: "Tạo hồ sơ, sửa dữ liệu gia phả, gắn tài khoản và chuẩn hóa các mối quan hệ.",
    create: ["admin", "clan_manager"],
    update: ["admin", "clan_manager"],
    view: ROLE_ORDER,
  },
  {
    code: "relationship",
    label: "Liên kết gia đình",
    description: "Gắn cha, mẹ, vợ/chồng, con; hệ thống kiểm tra chéo để tránh vòng lặp và sai vai trò.",
    create: ["admin", "clan_manager"],
    update: ["admin", "clan_manager"],
    view: ROLE_ORDER,
  },
  {
    code: "funds",
    label: "Quỹ và danh mục",
    description: "Mở quỹ, điều chỉnh mô tả quỹ và cấu hình danh mục thu/chi.",
    create: ["admin", "clan_manager", "treasurer"],
    update: ["admin", "clan_manager", "treasurer"],
    view: ["admin", "clan_manager", "treasurer", "approver"],
  },
  {
    code: "voucher_draft",
    label: "Lập phiếu / đề nghị chi",
    description: "Member chỉ được tạo đề nghị chi của chính mình; treasurer và manager có thể lập phiếu vận hành.",
    create: ["admin", "clan_manager", "treasurer", "member"],
    update: ["admin", "clan_manager", "treasurer", "member"],
    view: ROLE_ORDER,
  },
  {
    code: "voucher_approval",
    label: "Duyệt phiếu",
    description: "Nguyên tắc maker-checker: người duyệt không được duyệt phiếu do chính mình tạo.",
    create: [],
    approve: ["admin", "approver"],
    update: [],
    view: ["admin", "approver", "treasurer", "clan_manager"],
  },
  {
    code: "documents",
    label: "Tư liệu số",
    description: "Tạo tài liệu chung, đính kèm ảnh/chứng từ và gắn vào sự kiện hoặc hồ sơ thành viên.",
    create: ["admin", "clan_manager"],
    update: ["admin", "clan_manager"],
    view: ROLE_ORDER,
  },
  {
    code: "events",
    label: "Sự kiện và thông báo",
    description: "Lập sự kiện, ghim thông báo và phát đi nhắc lịch trong nội bộ dòng họ.",
    create: ["admin", "clan_manager"],
    update: ["admin", "clan_manager"],
    view: ROLE_ORDER,
  },
  {
    code: "account_linking",
    label: "Tài khoản & lời mời",
    description: "Mời tài khoản mới, gắn vào hồ sơ đã có, đổi email mời hoặc hủy lời mời chờ xử lý.",
    create: ["admin", "clan_manager"],
    update: ["admin", "clan_manager"],
    view: ["admin", "clan_manager"],
  },
  {
    code: "audit",
    label: "Nhật ký & báo cáo",
    description: "Theo dõi ai đã tạo/sửa/xóa/duyệt và đọc báo cáo tổng hợp.",
    create: [],
    update: [],
    view: ["admin", "clan_manager", "treasurer", "approver"],
  },
];

export function roleHasCapability(role: AppRole, roles: readonly AppRole[] | undefined) {
  return roles?.includes(role) ?? false;
}
