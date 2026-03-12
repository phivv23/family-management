import type { AppRole, MemberUpdateRequestStatus, VoucherStatus, VoucherType } from "@/lib/db/types";

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Quản trị viên",
  clan_manager: "Quản lý dòng họ",
  treasurer: "Thủ quỹ",
  approver: "Người duyệt",
  member: "Thành viên",
};

export const VOUCHER_TYPE_LABELS: Record<VoucherType, string> = {
  INCOME: "Thu",
  EXPENSE: "Chi",
};

export const VOUCHER_STATUS_LABELS: Record<VoucherStatus, string> = {
  DRAFT: "Bản nháp",
  PENDING: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Từ chối",
};

export const UPDATE_REQUEST_STATUS_LABELS: Record<MemberUpdateRequestStatus, string> = {
  PENDING: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Từ chối",
};

export const EVENT_TYPE_LABELS: Record<string, string> = {
  DEATH_ANNIVERSARY: "Giỗ",
  MEETING: "Họp họ",
  BIRTHDAY: "Sinh nhật",
  OTHER: "Khác",
};

export const GENDER_LABELS: Record<string, string> = {
  MALE: "Nam",
  FEMALE: "Nữ",
  OTHER: "Khác",
  UNKNOWN: "Chưa rõ",
};

export const DOCUMENT_VISIBILITY_LABELS: Record<string, string> = {
  CLAN: "Trong dòng họ",
  PUBLIC: "Công khai",
  MANAGER_ONLY: "Chỉ ban quản lý",
};

export const NOTIFICATION_KIND_LABELS: Record<string, string> = {
  ANNOUNCEMENT: "Thông báo",
  REMINDER: "Nhắc lịch",
  MEETING: "Lịch họp",
  SYSTEM_VOUCHER_SUBMITTED: "Hệ thống · Phiếu chờ duyệt",
  SYSTEM_VOUCHER_APPROVED: "Hệ thống · Phiếu đã duyệt",
  SYSTEM_VOUCHER_REJECTED: "Hệ thống · Phiếu bị từ chối",
  SYSTEM_INVITATION_CREATED: "Hệ thống · Đã gửi lời mời",
  SYSTEM_INVITATION_ACCEPTED: "Hệ thống · Đã nhận lời mời",
  SYSTEM_MEMBER_LINKED: "Hệ thống · Đã liên kết hồ sơ",
};

export function roleLabel(role: AppRole | string | null | undefined) {
  if (!role) return "-";
  return ROLE_LABELS[role as AppRole] ?? role;
}

export function voucherTypeLabel(type: VoucherType | string | null | undefined) {
  if (!type) return "-";
  return VOUCHER_TYPE_LABELS[type as VoucherType] ?? type;
}

export function voucherStatusLabel(status: VoucherStatus | string | null | undefined) {
  if (!status) return "-";
  return VOUCHER_STATUS_LABELS[status as VoucherStatus] ?? status;
}

export function eventTypeLabel(type: string | null | undefined) {
  if (!type) return "-";
  return EVENT_TYPE_LABELS[type] ?? type;
}

export function genderLabel(gender: string | null | undefined) {
  if (!gender) return "-";
  return GENDER_LABELS[gender] ?? gender;
}

export function documentVisibilityLabel(visibility: string | null | undefined) {
  if (!visibility) return "-";
  return DOCUMENT_VISIBILITY_LABELS[visibility] ?? visibility;
}

export function notificationKindLabel(kind: string | null | undefined) {
  if (!kind) return "-";
  return NOTIFICATION_KIND_LABELS[kind] ?? kind;
}

export function updateRequestStatusLabel(status: MemberUpdateRequestStatus | string | null | undefined) {
  if (!status) return "-";
  return UPDATE_REQUEST_STATUS_LABELS[status as MemberUpdateRequestStatus] ?? status;
}

export function formatDateVi(value: string | Date | null | undefined) {
  if (!value) return "-";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("vi-VN");
}
