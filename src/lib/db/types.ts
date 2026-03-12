export type AppRole = "admin" | "clan_manager" | "treasurer" | "approver" | "member";
export type VoucherType = "INCOME" | "EXPENSE";
export type VoucherStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";

export type ProfileRow = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  active_clan_id: string | null;
  gender?: "MALE" | "FEMALE" | "OTHER" | "UNKNOWN" | null;
  dob?: string | null;
  phone?: string | null;
  hometown?: string | null;
  address?: string | null;
  bio?: string | null;
};

export type FundRow = {
  id: string;
  clan_id: string;
  name: string;
  description: string | null;
  currency: string;
  is_active: boolean;
};
export type CategoryRow = { id: string; clan_id: string; name: string; voucher_type: VoucherType; };


export type NotificationRow = {
  id: string;
  clan_id: string;
  title: string;
  body: string | null;
  kind: string;
  event_id: string | null;
  scheduled_for: string | null;
  is_pinned: boolean;
  created_at: string;
};

export type MemberUpdateRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
