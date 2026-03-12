"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  addMemberByEmailAction,
  cancelClanInvitationAction,
  createAndLinkMemberProfileAction,
  createClanInvitationAction,
  linkClanMemberToMemberAction,
  setMemberRoleAction,
} from "./actions";
import { accountProfileModeEnum, roleEnum } from "@/lib/zod/admin";
import type { AppRole } from "@/lib/db/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { genderLabel, roleLabel } from "@/lib/i18n/labels";

type UserRow = { user_id: string; email: string; full_name: string; role: string; member_id: string | null; linked_member_name: string | null; link_block_reason: string | null };
type ClanMemberOption = { id: string; full_name: string };
type InvitationRow = {
  id: string;
  email: string;
  role: string;
  member_id: string | null;
  linked_member_name: string | null;
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

type NewMemberDraft = {
  fullName: string;
  gender: "MALE" | "FEMALE" | "OTHER" | "UNKNOWN";
  dob: string;
  bio: string;
};

const emptyDraft = (): NewMemberDraft => ({ fullName: "", gender: "UNKNOWN", dob: "", bio: "" });

function allowedRoles(currentRole: AppRole) {
  return currentRole === "admin"
    ? (["member", "approver", "treasurer", "clan_manager", "admin"] as const)
    : (["member", "approver", "treasurer"] as const);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("vi-VN");
}

function invitationStatusLabel(value: string) {
  switch (value) {
    case "PENDING": return "Đang chờ";
    case "ACCEPTED": return "Đã chấp nhận";
    case "EXPIRED": return "Đã hết hạn";
    case "CANCELLED": return "Đã hủy";
    default: return value;
  }
}

function getJoinLink(token: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/join/${token}`;
}

function InvitationResult({ link }: { link: string | null }) {
  if (!link) return null;
  const mailto = `mailto:?subject=${encodeURIComponent("Lời mời tham gia hệ thống quản lý dòng họ")}&body=${encodeURIComponent(`Bạn được mời tham gia dòng họ. Vui lòng mở liên kết sau để đăng ký hoặc đăng nhập rồi xác nhận tham gia:\n\n${link}`)}`;
  return (
    <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm">
      <div className="font-medium text-emerald-800">Đã tạo lời mời thành công</div>
      <div className="mt-2 break-all text-emerald-900">{link}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => navigator.clipboard.writeText(link)}>
          Sao chép liên kết
        </Button>
        <Button type="button" asChild>
          <a href={mailto}>Mở email để gửi</a>
        </Button>
      </div>
    </div>
  );
}

function MemberProfileModeSection({
  prefix,
  mode,
  setMode,
  selectedMemberId,
  setSelectedMemberId,
  options,
  draft,
  setDraft,
}: {
  prefix: string;
  mode: "none" | "existing" | "create";
  setMode: (value: "none" | "existing" | "create") => void;
  selectedMemberId: string;
  setSelectedMemberId: (value: string) => void;
  options: ClanMemberOption[];
  draft: NewMemberDraft;
  setDraft: (updater: (prev: NewMemberDraft) => NewMemberDraft) => void;
}) {
  return (
    <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="space-y-1">
          <Label>{prefix} hồ sơ thành viên</Label>
          <select
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
            value={mode}
            onChange={(e) => setMode(accountProfileModeEnum.parse(e.target.value))}
          >
            <option value="none">Chưa gắn ngay</option>
            <option value="existing">Gắn hồ sơ có sẵn</option>
            <option value="create">Tạo hồ sơ mới ngay</option>
          </select>
        </div>
        {mode === "existing" ? (
          <div className="space-y-1 md:col-span-2">
            <Label>Chọn hồ sơ có sẵn</Label>
            <select
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={selectedMemberId}
              onChange={(e) => setSelectedMemberId(e.target.value)}
            >
              <option value="">(chọn hồ sơ thành viên)</option>
              {options.map((item) => (
                <option key={item.id} value={item.id}>{item.full_name}</option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      {mode === "create" ? (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1 md:col-span-2">
            <Label>Họ và tên thành viên</Label>
            <Input value={draft.fullName} onChange={(e) => setDraft((s) => ({ ...s, fullName: e.target.value }))} placeholder="Ví dụ: Nguyễn Văn A" />
          </div>
          <div className="space-y-1">
            <Label>Giới tính</Label>
            <select
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={draft.gender}
              onChange={(e) => setDraft((s) => ({ ...s, gender: e.target.value as NewMemberDraft["gender"] }))}
            >
              <option value="UNKNOWN">{genderLabel("UNKNOWN")}</option>
              <option value="MALE">{genderLabel("MALE")}</option>
              <option value="FEMALE">{genderLabel("FEMALE")}</option>
              <option value="OTHER">{genderLabel("OTHER")}</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label>Ngày sinh</Label>
            <Input type="date" value={draft.dob} onChange={(e) => setDraft((s) => ({ ...s, dob: e.target.value }))} />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Ghi chú ngắn</Label>
            <Input value={draft.bio} onChange={(e) => setDraft((s) => ({ ...s, bio: e.target.value }))} placeholder="Ví dụ: Con trưởng chi 3" />
          </div>
        </div>
      ) : null}

      {mode === "none" ? (
        <div className="text-xs text-amber-700">
          Tài khoản sẽ được thêm vào dòng họ nhưng chưa xuất hiện trong cây gia phả cho tới khi được gắn với một hồ sơ thành viên.
        </div>
      ) : null}
    </div>
  );
}

function LinkingStatus({ row }: { row: MemberLinkingRow }) {
  if (row.linked_user_id) {
    return (
      <div className="space-y-0.5 text-sm">
        <div className="font-medium text-emerald-700">Đã liên kết tài khoản</div>
        <div>{row.linked_account_name || row.linked_email}</div>
        <div className="text-xs text-slate-500">{row.linked_email} · {roleLabel(row.linked_role || "member")}</div>
      </div>
    );
  }

  if (row.pending_invitation_id) {
    return (
      <div className="space-y-0.5 text-sm">
        <div className="font-medium text-amber-700">Đã tạo lời mời</div>
        <div>{row.pending_invitation_email}</div>
        <div className="text-xs text-slate-500">Hết hạn {formatDate(row.pending_invitation_expires_at)}</div>
      </div>
    );
  }

  return <div className="text-sm text-slate-500">Chưa cấp tài khoản</div>;
}

export function AdminUsersClient({
  members,
  clanMembers,
  availableMembers,
  invitations,
  currentUserId,
  currentRole,
  memberLinking,
  preselectedMemberId,
}: {
  members: UserRow[];
  clanMembers: ClanMemberOption[];
  availableMembers: ClanMemberOption[];
  invitations: InvitationRow[];
  currentUserId: string;
  currentRole: AppRole;
  memberLinking: MemberLinkingRow[];
  preselectedMemberId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successLink, setSuccessLink] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const allowed = allowedRoles(currentRole);

  const [selectedMemberForInvite, setSelectedMemberForInvite] = useState(preselectedMemberId ?? "");
  const [selectedMemberInviteEmail, setSelectedMemberInviteEmail] = useState("");
  const [selectedMemberInviteRole, setSelectedMemberInviteRole] = useState<(typeof allowed)[number]>("member");
  const [selectedMemberInviteExpireDays, setSelectedMemberInviteExpireDays] = useState("14");
  const [selectedMemberInviteNote, setSelectedMemberInviteNote] = useState("");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<(typeof allowed)[number]>("member");
  const [inviteMode, setInviteMode] = useState<"none" | "existing" | "create">("create");
  const [inviteMemberId, setInviteMemberId] = useState("");
  const [inviteDraft, setInviteDraft] = useState<NewMemberDraft>(emptyDraft());
  const [inviteExpireDays, setInviteExpireDays] = useState("14");
  const [inviteNote, setInviteNote] = useState("");

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<(typeof allowed)[number]>("member");
  const [addMode, setAddMode] = useState<"none" | "existing" | "create">("create");
  const [newMemberId, setNewMemberId] = useState("");
  const [addDraft, setAddDraft] = useState<NewMemberDraft>(emptyDraft());
  const [memberLinks, setMemberLinks] = useState<Record<string, string>>(() => Object.fromEntries(members.map((m) => [m.user_id, m.member_id ?? ""])));
  const [rowDrafts, setRowDrafts] = useState<Record<string, NewMemberDraft>>({});
  const [rowExpanded, setRowExpanded] = useState<Record<string, boolean>>({});

  const selectableForLink = useMemo(() => {
    const takenByUsers = new Set(Object.values(memberLinks).filter(Boolean));
    return clanMembers.filter((m) => !takenByUsers.has(m.id));
  }, [clanMembers, memberLinks]);

  const memberLinkingById = useMemo(() => new Map(memberLinking.map((row) => [row.member_id, row])), [memberLinking]);
  const selectedMemberRow = selectedMemberForInvite ? (memberLinkingById.get(selectedMemberForInvite) ?? null) : null;
  const unlinkedMembers = useMemo(() => memberLinking.filter((row) => !row.linked_user_id), [memberLinking]);

  function getDefaultDraftForRow(user: UserRow): NewMemberDraft {
    const localName = user.email.split("@")[0]?.replace(/[._-]+/g, " ").trim();
    return {
      fullName: user.full_name?.trim() || localName || "",
      gender: "UNKNOWN",
      dob: "",
      bio: "",
    };
  }

  async function createInviteForExistingMember(memberId: string) {
    const res = await createClanInvitationAction({
      email: selectedMemberInviteEmail,
      role: selectedMemberInviteRole,
      expireDays: Number(selectedMemberInviteExpireDays),
      note: selectedMemberInviteNote || null,
      linkMode: "existing",
      memberId,
      newMember: null,
    });

    if (!res.ok) {
      setError(res.error);
      return;
    }

    const link = res.inviteToken ? getJoinLink(res.inviteToken) : null;
    setSuccessLink(link);
    setSuccessMessage("Đã tạo lời mời gắn với hồ sơ thành viên có sẵn.");
    setSelectedMemberInviteEmail("");
    setSelectedMemberInviteNote("");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {successMessage ? <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{successMessage}</div> : null}

      <div className="rounded-md border border-slate-200 bg-white p-4">
        <div className="font-medium">Hồ sơ thành viên chưa có tài khoản</div>
        <div className="mt-3 overflow-x-auto">
          <Table>
            <THead>
              <TR><TH>Thành viên</TH><TH>Thông tin</TH><TH>Trạng thái</TH><TH>Thao tác</TH></TR>
            </THead>
            <TBody>
              {unlinkedMembers.length === 0 ? (
                <TR><TD colSpan={4} className="text-sm text-slate-500">Tất cả hồ sơ hiện đã có tài khoản hoặc không còn hồ sơ chờ cấp tài khoản.</TD></TR>
              ) : unlinkedMembers.map((row) => (
                <TR key={row.member_id}>
                  <TD className="whitespace-nowrap">
                    <div className="font-medium">{row.member_name}</div>
                    <div className="text-xs text-slate-500">{genderLabel(row.gender)} · {formatDate(row.dob)}</div>
                  </TD>
                  <TD className="text-sm text-slate-500">Một hồ sơ thành viên chỉ nên gắn đúng một tài khoản đăng nhập.</TD>
                  <TD><LinkingStatus row={row} /></TD>
                  <TD className="space-x-2 whitespace-nowrap">
                    <Button type="button" variant="outline" onClick={() => {
                      setError(null);
                      setSuccessMessage(null);
                      setSelectedMemberForInvite(row.member_id);
                      setSelectedMemberInviteEmail(row.pending_invitation_email ?? "");
                      setSelectedMemberInviteRole(roleEnum.parse(row.pending_invitation_role ?? "member") as (typeof allowed)[number]);
                      setSelectedMemberInviteNote(row.pending_invitation_note ?? "");
                    }}>
                      {row.pending_invitation_id ? "Mời lại / đổi email" : "Mời cấp tài khoản"}
                    </Button>
                    {row.pending_invitation_token ? (
                      <Button type="button" variant="outline" onClick={() => navigator.clipboard.writeText(getJoinLink(row.pending_invitation_token!))}>
                        Sao chép link
                      </Button>
                    ) : null}
                    {row.pending_invitation_id ? (
                      <Button type="button" variant="outline" disabled={pending} onClick={() => {
                        setError(null);
                        setSuccessMessage(null);
                        startTransition(async () => {
                          const res = await cancelClanInvitationAction({ invitationId: row.pending_invitation_id });
                          if (!res.ok) setError(res.error);
                          else {
                            setSuccessMessage("Đã hủy lời mời đang chờ của hồ sơ này.");
                            router.refresh();
                          }
                        });
                      }}>
                        Hủy lời mời
                      </Button>
                    ) : null}
                    <Button asChild variant="outline"><Link href={`/members/${row.member_id}`}>Mở hồ sơ</Link></Button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>

        {selectedMemberRow ? (
          <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-medium">Mời tài khoản cho hồ sơ: {selectedMemberRow.member_name}</div>
                <div className="text-xs text-slate-500">Lời mời sẽ được khóa vào đúng hồ sơ này để tránh tạo trùng thành viên.</div>
              </div>
              <Button type="button" variant="outline" onClick={() => setSelectedMemberForInvite("")}>Đóng</Button>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-4">
              <div className="space-y-1 md:col-span-2">
                <Label>Email người được mời</Label>
                <Input value={selectedMemberInviteEmail} onChange={(e) => setSelectedMemberInviteEmail(e.target.value)} placeholder="nguoithan@example.com" />
              </div>
              <div className="space-y-1">
                <Label>Vai trò</Label>
                <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" value={selectedMemberInviteRole} onChange={(e) => setSelectedMemberInviteRole(roleEnum.parse(e.target.value) as (typeof allowed)[number])}>
                  {allowed.map((item) => <option key={item} value={item}>{roleLabel(item)}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Hết hạn sau (ngày)</Label>
                <Input value={selectedMemberInviteExpireDays} onChange={(e) => setSelectedMemberInviteExpireDays(e.target.value)} placeholder="14" />
              </div>
              <div className="space-y-1 md:col-span-4">
                <Label>Ghi chú</Label>
                <Input value={selectedMemberInviteNote} onChange={(e) => setSelectedMemberInviteNote(e.target.value)} placeholder="Ví dụ: Dùng đúng email cá nhân để gắn với hồ sơ này" />
              </div>
            </div>

            <div className="mt-3 flex justify-end">
              <Button disabled={pending || !selectedMemberInviteEmail} onClick={() => {
                setError(null);
                setSuccessMessage(null);
                setSuccessLink(null);
                startTransition(async () => {
                  await createInviteForExistingMember(selectedMemberRow.member_id);
                });
              }}>
                {pending ? "Đang tạo lời mời..." : "Tạo lời mời cho hồ sơ này"}
              </Button>
            </div>
          </div>
        ) : null}
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        <div className="mt-3"><InvitationResult link={successLink} /></div>
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-4">
        <div className="font-medium">Mời người thân tham gia bằng email/link</div>
        <div className="mt-1 text-xs text-slate-500">
          Dùng khi người đó chưa có tài khoản trong hệ thống. Nếu hồ sơ thành viên đã tồn tại, ưu tiên chọn hồ sơ có sẵn để tránh trùng dữ liệu gia phả.
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-4">
          <div className="space-y-1 lg:col-span-2">
            <Label>Email người được mời</Label>
            <Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="nguoithan@example.com" />
          </div>
          <div className="space-y-1">
            <Label>Vai trò</Label>
            <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" value={inviteRole} onChange={(e) => setInviteRole(roleEnum.parse(e.target.value) as (typeof allowed)[number])}>
              {allowed.map((item) => <option key={item} value={item}>{roleLabel(item)}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Hết hạn sau (ngày)</Label>
            <Input value={inviteExpireDays} onChange={(e) => setInviteExpireDays(e.target.value)} placeholder="14" />
          </div>
        </div>

        <div className="mt-3">
          <MemberProfileModeSection prefix="Cách gắn" mode={inviteMode} setMode={setInviteMode} selectedMemberId={inviteMemberId} setSelectedMemberId={setInviteMemberId} options={availableMembers} draft={inviteDraft} setDraft={setInviteDraft} />
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_auto]">
          <div className="space-y-1">
            <Label>Ghi chú gửi kèm</Label>
            <Input value={inviteNote} onChange={(e) => setInviteNote(e.target.value)} placeholder="Ví dụ: Hồ sơ của con trưởng chi 3" />
          </div>
          <div className="flex items-end justify-end">
            <Button
              disabled={pending}
              onClick={() => {
                setError(null);
                setSuccessMessage(null);
                setSuccessLink(null);
                startTransition(async () => {
                  const res = await createClanInvitationAction({
                    email: inviteEmail,
                    role: inviteRole,
                    expireDays: Number(inviteExpireDays),
                    note: inviteNote || null,
                    linkMode: inviteMode,
                    memberId: inviteMemberId || null,
                    newMember: inviteMode === "create" ? { fullName: inviteDraft.fullName, gender: inviteDraft.gender, dob: inviteDraft.dob || null, bio: inviteDraft.bio || null } : null,
                  });
                  if (!res.ok) {
                    setError(res.error);
                    return;
                  }
                  const link = res.inviteToken ? getJoinLink(res.inviteToken) : null;
                  setSuccessLink(link);
                  setSuccessMessage("Đã tạo lời mời mới. Người được mời có thể đăng ký hoặc đăng nhập bằng đúng email để tham gia.");
                  setInviteEmail("");
                  setInviteMemberId("");
                  setInviteDraft(emptyDraft());
                  setInviteNote("");
                  router.refresh();
                });
              }}
            >
              {pending ? "Đang tạo lời mời..." : "Tạo lời mời"}
            </Button>
          </div>
        </div>
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        <div className="mt-3"><InvitationResult link={successLink} /></div>
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-4">
        <div className="font-medium">Lời mời đang chờ xác nhận</div>
        <div className="mt-3 overflow-x-auto">
          <Table>
            <THead>
              <TR><TH>Email</TH><TH>Vai trò</TH><TH>Hồ sơ gắn sẵn</TH><TH>Hết hạn</TH><TH>Trạng thái</TH><TH>Thao tác</TH></TR>
            </THead>
            <TBody>
              {invitations.length === 0 ? (
                <TR><TD colSpan={6} className="text-sm text-slate-500">Chưa có lời mời nào.</TD></TR>
              ) : invitations.map((invite) => {
                const canCancel = invite.status === "PENDING";
                return (
                  <TR key={invite.id}>
                    <TD>{invite.email}</TD>
                    <TD>{roleLabel(invite.role)}</TD>
                    <TD>{invite.linked_member_name ?? "-"}</TD>
                    <TD>{formatDate(invite.expires_at)}</TD>
                    <TD>{invitationStatusLabel(invite.status)}</TD>
                    <TD className="space-x-2 whitespace-nowrap">
                      <Button type="button" variant="outline" onClick={() => navigator.clipboard.writeText(getJoinLink(invite.token))}>Sao chép link</Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!canCancel || pending}
                        onClick={() => {
                          setError(null);
                          setSuccessMessage(null);
                          startTransition(async () => {
                            const res = await cancelClanInvitationAction({ invitationId: invite.id });
                            if (!res.ok) setError(res.error);
                            else {
                              setSuccessMessage("Đã hủy lời mời.");
                              router.refresh();
                            }
                          });
                        }}
                      >
                        Hủy lời mời
                      </Button>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </div>
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-4">
        <div className="font-medium">Thêm nhanh tài khoản đã có trong hệ thống</div>
        <div className="mt-1 text-xs text-slate-500">Dùng khi người thân đã đăng ký tài khoản trước đó. Bạn có thể gắn hồ sơ có sẵn hoặc tạo hồ sơ thành viên mới ngay trong một lần thao tác.</div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label>Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" />
          </div>
          <div className="space-y-1">
            <Label>Vai trò</Label>
            <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" value={role} onChange={(e) => setRole(roleEnum.parse(e.target.value) as (typeof allowed)[number])}>
              {allowed.map((item) => <option key={item} value={item}>{roleLabel(item)}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-3">
          <MemberProfileModeSection prefix="Cách gắn" mode={addMode} setMode={setAddMode} selectedMemberId={newMemberId} setSelectedMemberId={setNewMemberId} options={availableMembers} draft={addDraft} setDraft={setAddDraft} />
        </div>

        <div className="mt-3 flex justify-end">
          <Button
            disabled={pending}
            onClick={() => {
              setError(null);
              setSuccessMessage(null);
              startTransition(async () => {
                const res = await addMemberByEmailAction({
                  email,
                  role,
                  linkMode: addMode,
                  memberId: newMemberId || null,
                  newMember: addMode === "create" ? { fullName: addDraft.fullName, gender: addDraft.gender, dob: addDraft.dob || null, bio: addDraft.bio || null } : null,
                });
                if (!res.ok) setError(res.error);
                else {
                  setEmail("");
                  setNewMemberId("");
                  setAddDraft(emptyDraft());
                  setSuccessMessage("Đã thêm tài khoản vào dòng họ.");
                  router.refresh();
                }
              });
            }}
          >
            {pending ? "Đang thêm..." : "Thêm tài khoản"}
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <THead>
            <TR><TH>Email</TH><TH>Tên hiển thị</TH><TH>Vai trò</TH><TH>Hồ sơ thành viên</TH><TH>Thao tác</TH></TR>
          </THead>
          <TBody>
            {members.map((m) => {
              const isSelf = m.user_id === currentUserId;
              const lockedByManager = currentRole !== "admin" && ["admin", "clan_manager"].includes(m.role);
              const canEdit = !isSelf && !lockedByManager;
              const currentLinked = memberLinks[m.user_id] ?? "";
              const optionsForThisUser = clanMembers.filter((item) => item.id === currentLinked || selectableForLink.some((opt) => opt.id === item.id));
              const draft = rowDrafts[m.user_id] ?? getDefaultDraftForRow(m);
              const linkBlocked = Boolean(m.link_block_reason);
              const canCreateAndLink = canEdit && !linkBlocked && !currentLinked;
              const canSaveLink = canEdit && (!linkBlocked || !currentLinked || currentLinked === (m.member_id ?? ""));

              return (
                <TR key={m.user_id}>
                  <TD className="whitespace-nowrap">{m.email}</TD>
                  <TD className="whitespace-nowrap">{m.full_name || "-"}</TD>
                  <TD className="whitespace-nowrap">{roleLabel(m.role)}</TD>
                  <TD className="min-w-[320px]">
                    <div className="space-y-2">
                      <select className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm disabled:opacity-50" value={currentLinked} disabled={!canEdit || (linkBlocked && !currentLinked)} onChange={(e) => setMemberLinks((prev) => ({ ...prev, [m.user_id]: e.target.value }))}>
                        <option value="">(chưa liên kết)</option>
                        {optionsForThisUser.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}
                      </select>
                      <div className="text-xs text-slate-500">Hiện tại: {m.linked_member_name ? `Đã gắn với ${m.linked_member_name}` : "Chưa liên kết"}</div>
                      {m.link_block_reason ? (
                        <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                          {m.link_block_reason}
                          {currentLinked ? " Bạn nên gỡ liên kết hiện tại trước khi chuẩn hóa lại." : " Tài khoản này hiện chưa đủ điều kiện để gắn vào hồ sơ có sẵn của dòng họ này."}
                        </div>
                      ) : null}
                      {!currentLinked && canEdit ? (
                        <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
                          {optionsForThisUser.length === 0 ? "Hiện chưa có hồ sơ thành viên trống để chọn. Bạn có thể tạo hồ sơ mới ngay bên dưới rồi gắn trực tiếp cho tài khoản này." : "Bạn có thể chọn hồ sơ có sẵn hoặc tạo hồ sơ mới để gắn trực tiếp cho tài khoản này."}
                        </div>
                      ) : null}
                      {!currentLinked && canEdit ? (
                        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <div className="text-sm font-medium">Tạo hồ sơ mới và gắn ngay</div>
                            <Button type="button" variant="outline" disabled={!canCreateAndLink} onClick={() => setRowExpanded((prev) => ({ ...prev, [m.user_id]: !prev[m.user_id] }))}>
                              {rowExpanded[m.user_id] ? "Ẩn" : "Tạo hồ sơ mới"}
                            </Button>
                          </div>
                          {rowExpanded[m.user_id] ? (
                            <div className="grid gap-2 md:grid-cols-2">
                              <div className="space-y-1 md:col-span-2">
                                <Label>Họ và tên</Label>
                                <Input value={draft.fullName} onChange={(e) => setRowDrafts((prev) => ({ ...prev, [m.user_id]: { ...draft, fullName: e.target.value } }))} />
                              </div>
                              <div className="space-y-1">
                                <Label>Giới tính</Label>
                                <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" value={draft.gender} onChange={(e) => setRowDrafts((prev) => ({ ...prev, [m.user_id]: { ...draft, gender: e.target.value as NewMemberDraft['gender'] } }))}>
                                  <option value="UNKNOWN">{genderLabel("UNKNOWN")}</option>
                                  <option value="MALE">{genderLabel("MALE")}</option>
                                  <option value="FEMALE">{genderLabel("FEMALE")}</option>
                                  <option value="OTHER">{genderLabel("OTHER")}</option>
                                </select>
                              </div>
                              <div className="space-y-1">
                                <Label>Ngày sinh</Label>
                                <Input type="date" value={draft.dob} onChange={(e) => setRowDrafts((prev) => ({ ...prev, [m.user_id]: { ...draft, dob: e.target.value } }))} />
                              </div>
                              <div className="space-y-1 md:col-span-2">
                                <Label>Ghi chú</Label>
                                <Input value={draft.bio} onChange={(e) => setRowDrafts((prev) => ({ ...prev, [m.user_id]: { ...draft, bio: e.target.value } }))} placeholder="Ví dụ: Thông tin đối chiếu khi đăng ký" />
                              </div>
                              <div className="md:col-span-2 flex justify-end">
                                <Button type="button" disabled={pending || !canCreateAndLink} onClick={() => {
                                  setError(null);
                                  setSuccessMessage(null);
                                  startTransition(async () => {
                                    const res = await createAndLinkMemberProfileAction({
                                      userId: m.user_id,
                                      newMember: {
                                        fullName: draft.fullName,
                                        gender: draft.gender,
                                        dob: draft.dob || null,
                                        bio: draft.bio || null,
                                      },
                                    });
                                    if (!res.ok) {
                                      setError(res.error);
                                      return;
                                    }
                                    setSuccessMessage(`Đã tạo hồ sơ và gắn cho tài khoản ${m.email}.`);
                                    setRowExpanded((prev) => ({ ...prev, [m.user_id]: false }));
                                    router.refresh();
                                  });
                                }}>
                                  Tạo hồ sơ và gắn ngay
                                </Button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </TD>
                  <TD className="min-w-[320px] space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <select className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm disabled:opacity-50" defaultValue={m.role} disabled={!canEdit} onChange={(e) => {
                        const nextRole = roleEnum.parse(e.target.value);
                        startTransition(async () => {
                          const res = await setMemberRoleAction({ userId: m.user_id, role: nextRole });
                          if (!res.ok) setError(res.error);
                          else {
                            setSuccessMessage("Đã cập nhật vai trò tài khoản.");
                            router.refresh();
                          }
                        });
                      }}>
                        {allowed.map((item) => <option key={item} value={item}>{roleLabel(item)}</option>)}
                      </select>
                      <Button variant="outline" disabled={!canSaveLink || pending} onClick={() => {
                        startTransition(async () => {
                          const value = memberLinks[m.user_id] || null;
                          const res = await linkClanMemberToMemberAction({ userId: m.user_id, memberId: value });
                          if (!res.ok) setError(res.error);
                          else {
                            setSuccessMessage("Đã cập nhật liên kết hồ sơ thành viên.");
                            router.refresh();
                          }
                        });
                      }}>
                        Lưu liên kết
                      </Button>
                    </div>
                    {!canEdit ? <span className="text-xs text-slate-500">Bạn không thể sửa tài khoản này với quyền hiện tại.</span> : null}
                    {canEdit && linkBlocked && !currentLinked ? <span className="text-xs text-red-600">Hệ thống đã khóa thao tác gắn hồ sơ cho tài khoản này vì còn xung đột liên dòng họ hoặc vai trò.</span> : null}
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
