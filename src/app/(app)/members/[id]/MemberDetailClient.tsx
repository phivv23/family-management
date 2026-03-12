"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { genderEnum, partnerCloseStatusEnum } from "@/lib/zod/member";
import {
  addParentChildAction,
  addPartnerRelationshipAction,
  closePartnerRelationshipAction,
  deleteMemberAction,
  removeParentChildAction,
  removeSpouseAction,
  updateMemberAction,
} from "@/app/(app)/members/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { genderLabel, roleLabel } from "@/lib/i18n/labels";

type Member = {
  id: string;
  full_name: string;
  gender: "MALE" | "FEMALE" | "OTHER" | "UNKNOWN";
  dob: string | null;
  dod: string | null;
  bio: string | null;
};

type ParentRole = "FATHER" | "MOTHER" | "PARENT" | null;
type ChildLinkType = "BIOLOGICAL" | "ADOPTED" | null;
type Rel = { id: string; full_name: string; gender: string | null };
type ParentRel = Rel & { parent_role: ParentRole; child_link_type: ChildLinkType };
type ChildRel = Rel & { child_link_type: ChildLinkType };
type ParentChildEdge = { parent_id: string; child_id: string; parent_role: ParentRole; child_link_type: ChildLinkType };
type LinkedAccount = { email: string; full_name: string | null; role: string } | null;
type PendingInvitation = { email: string; expires_at: string | null; token: string | null } | null;
type PartnerRelationship = {
  id: string;
  member_a_id: string;
  member_b_id: string;
  relationship_kind: "MARRIAGE" | "PARTNERSHIP";
  relationship_status: "CURRENT" | "DIVORCED" | "SEPARATED" | "WIDOWED";
  started_on: string | null;
  ended_on: string | null;
  note: string | null;
};

type RelationshipListItem = PartnerRelationship & { other: Rel | null };

function relationshipOptions(source: Rel[], exclude: Set<string>, predicate?: (item: Rel) => boolean) {
  return source.filter((item) => !exclude.has(item.id) && (predicate ? predicate(item) : true));
}

function buildAdjacency(edges: ParentChildEdge[]) {
  const childrenByParent = new Map<string, string[]>();
  const parentsByChild = new Map<string, string[]>();

  for (const edge of edges) {
    const children = childrenByParent.get(edge.parent_id) ?? [];
    children.push(edge.child_id);
    childrenByParent.set(edge.parent_id, children);

    const parents = parentsByChild.get(edge.child_id) ?? [];
    parents.push(edge.parent_id);
    parentsByChild.set(edge.child_id, parents);
  }

  return { childrenByParent, parentsByChild };
}

function collectReachable(startId: string, adjacency: Map<string, string[]>) {
  const visited = new Set<string>();
  const queue = [...(adjacency.get(startId) ?? [])];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);
    for (const next of adjacency.get(current) ?? []) {
      if (!visited.has(next)) queue.push(next);
    }
  }

  return visited;
}

function toArray(set: Set<string>) {
  return Array.from(set.values());
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("vi-VN");
}

function getJoinLink(token: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/join/${token}`;
}

function parentRoleLabel(role: ParentRole) {
  if (role === "FATHER") return "Cha";
  if (role === "MOTHER") return "Mẹ";
  return "Cha/mẹ chưa chuẩn hóa";
}

function childLinkTypeLabel(kind: ChildLinkType) {
  if (kind === "ADOPTED") return "Con nuôi";
  return "Con ruột";
}

function partnerKindLabel(kind: PartnerRelationship["relationship_kind"]) {
  return kind === "PARTNERSHIP" ? "Bạn đời" : "Hôn nhân";
}

function partnerStatusLabel(status: PartnerRelationship["relationship_status"]) {
  if (status === "CURRENT") return "Hiện tại";
  if (status === "DIVORCED") return "Đã ly hôn";
  if (status === "SEPARATED") return "Đã ly thân";
  if (status === "WIDOWED") return "Góa";
  return status;
}

function inferredParentRole(gender: Member["gender"]): "FATHER" | "MOTHER" | null {
  if (gender === "MALE") return "FATHER";
  if (gender === "FEMALE") return "MOTHER";
  return null;
}

function siblingIdsOf(memberId: string, parentsByChild: Map<string, string[]>, childrenByParent: Map<string, string[]>) {
  const siblings = new Set<string>();
  for (const parentId of parentsByChild.get(memberId) ?? []) {
    for (const childId of childrenByParent.get(parentId) ?? []) {
      if (childId !== memberId) siblings.add(childId);
    }
  }
  return siblings;
}

function relationChip(text: string) {
  return <Badge variant="outline">{text}</Badge>;
}

function partnerStatusChip(status: PartnerRelationship["relationship_status"]) {
  const className = status === "CURRENT"
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : status === "DIVORCED"
    ? "bg-slate-100 text-slate-700 border-slate-200"
    : status === "SEPARATED"
    ? "bg-amber-50 text-amber-800 border-amber-200"
    : "bg-rose-50 text-rose-700 border-rose-200";
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${className}`}>{partnerStatusLabel(status)}</span>;
}

export function MemberDetailClient({
  canEdit,
  member,
  linkedAccount,
  pendingInvitation,
  allMembers,
  parents,
  children,
  spouses,
  allParentChild,
  partnerHistory,
}: {
  canEdit: boolean;
  member: Member;
  linkedAccount: LinkedAccount;
  pendingInvitation: PendingInvitation;
  allMembers: Rel[];
  parents: ParentRel[];
  children: ChildRel[];
  spouses: Rel[];
  allParentChild: ParentChildEdge[];
  partnerHistory: PartnerRelationship[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState(member.full_name);
  const [gender, setGender] = useState<Member["gender"]>(member.gender);
  const [dob, setDob] = useState(member.dob ?? "");
  const [dod, setDod] = useState(member.dod ?? "");
  const [bio, setBio] = useState(member.bio ?? "");

  const [pickFather, setPickFather] = useState<string>("");
  const [pickMother, setPickMother] = useState<string>("");
  const [pickChild, setPickChild] = useState<string>("");
  const [pickChildLinkType, setPickChildLinkType] = useState<"BIOLOGICAL" | "ADOPTED">("BIOLOGICAL");
  const [pickSpouse, setPickSpouse] = useState<string>("");
  const [pickSpouseStartedOn, setPickSpouseStartedOn] = useState<string>("");
  const [pickSpouseNote, setPickSpouseNote] = useState<string>("");
  const [closeStatus, setCloseStatus] = useState<"DIVORCED" | "SEPARATED" | "WIDOWED">("DIVORCED");
  const [closeEndedOn, setCloseEndedOn] = useState<string>("");
  const [closeNote, setCloseNote] = useState<string>("");

  const memberMap = useMemo(() => new Map(allMembers.map((item) => [item.id, item])), [allMembers]);

  const relationshipGuardrails = useMemo(() => {
    const { childrenByParent, parentsByChild } = buildAdjacency(allParentChild);
    const ancestorIds = collectReachable(member.id, parentsByChild);
    const descendantIds = collectReachable(member.id, childrenByParent);
    const siblingIds = siblingIdsOf(member.id, parentsByChild, childrenByParent);
    const directParentIds = new Set(parents.map((m) => m.id));
    const directChildIds = new Set(children.map((m) => m.id));
    const directSpouseIds = new Set(spouses.map((m) => m.id));

    const invalidParentIds = new Set<string>([
      member.id,
      ...toArray(directParentIds),
      ...toArray(directChildIds),
      ...toArray(directSpouseIds),
      ...toArray(ancestorIds),
      ...toArray(descendantIds),
    ]);

    const invalidChildIds = new Set<string>([
      member.id,
      ...toArray(directParentIds),
      ...toArray(directChildIds),
      ...toArray(directSpouseIds),
      ...toArray(ancestorIds),
      ...toArray(descendantIds),
    ]);

    const invalidSpouseIds = new Set<string>([
      member.id,
      ...toArray(directParentIds),
      ...toArray(directChildIds),
      ...toArray(directSpouseIds),
      ...toArray(ancestorIds),
      ...toArray(descendantIds),
      ...toArray(siblingIds),
    ]);

    const fatherLinked = parents.some((p) => p.parent_role === "FATHER");
    const motherLinked = parents.some((p) => p.parent_role === "MOTHER");
    return {
      parentSlotsFull: directParentIds.size >= 2,
      fatherLinked,
      motherLinked,
      fatherCandidates: relationshipOptions(allMembers, invalidParentIds, (item) => item.gender === "MALE"),
      motherCandidates: relationshipOptions(allMembers, invalidParentIds, (item) => item.gender === "FEMALE"),
      childCandidates: relationshipOptions(allMembers, invalidChildIds),
      spouseCandidates: relationshipOptions(allMembers, invalidSpouseIds),
      spouseSlotTaken: spouses.length >= 1,
    };
  }, [allMembers, allParentChild, children, member.id, parents, spouses]);

  const fatherLinks = parents.filter((p) => p.parent_role === "FATHER");
  const motherLinks = parents.filter((p) => p.parent_role === "MOTHER");
  const legacyParentLinks = parents.filter((p) => p.parent_role !== "FATHER" && p.parent_role !== "MOTHER");
  const selfParentRole = inferredParentRole(member.gender);

  const partnerRelations = useMemo<RelationshipListItem[]>(() => {
    return partnerHistory.map((item) => {
      const otherId = item.member_a_id === member.id ? item.member_b_id : item.member_a_id;
      return { ...item, other: memberMap.get(otherId) ?? null };
    });
  }, [member.id, memberMap, partnerHistory]);

  const currentPartnerRelations = partnerRelations.filter((item) => item.relationship_status === "CURRENT");
  const formerPartnerRelations = partnerRelations.filter((item) => item.relationship_status !== "CURRENT");

  const familyContext = useMemo(() => {
    const { childrenByParent, parentsByChild } = buildAdjacency(allParentChild);
    const spouseChildren = new Set<string>();
    const coParents = new Set<string>();
    const stepParents = new Set<string>();

    for (const spouse of spouses) {
      for (const childId of childrenByParent.get(spouse.id) ?? []) {
        if (!children.some((child) => child.id === childId)) spouseChildren.add(childId);
      }
    }

    for (const parent of parents) {
      for (const current of partnerRelations.filter((item) => item.relationship_status === "CURRENT")) {
        const otherId = current.member_a_id === parent.id ? current.member_b_id : current.member_b_id === parent.id ? current.member_a_id : null;
        if (otherId && otherId !== member.id) stepParents.add(otherId);
      }
    }

    for (const child of children) {
      for (const parentId of parentsByChild.get(child.id) ?? []) {
        if (parentId !== member.id) coParents.add(parentId);
      }
    }

    const adoptedChildren = children.filter((item) => item.child_link_type === "ADOPTED");
    const biologicalChildren = children.filter((item) => item.child_link_type !== "ADOPTED");

    return {
      spouseChildren: allMembers.filter((item) => spouseChildren.has(item.id)),
      coParents: allMembers.filter((item) => coParents.has(item.id)),
      stepParents: allMembers.filter((item) => stepParents.has(item.id)),
      adoptedChildren,
      biologicalChildren,
    };
  }, [allMembers, allParentChild, children, member.id, parents, partnerRelations, spouses]);

  const runAndRefresh = async (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    const res = await fn();
    if (!res.ok) {
      setError(res.error ?? "Có lỗi xảy ra");
      return;
    }
    router.refresh();
  };

  return (
    <div className="space-y-4">
      {error ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><div className="font-semibold">Hồ sơ thành viên</div></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Họ tên</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={!canEdit || pending} />
              </div>
              <div className="space-y-1">
                <Label>Giới tính</Label>
                <select
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                  value={gender}
                  onChange={(e) => setGender(genderEnum.parse(e.target.value))}
                  disabled={!canEdit || pending}
                >
                  <option value="UNKNOWN">Chưa rõ</option>
                  <option value="MALE">Nam</option>
                  <option value="FEMALE">Nữ</option>
                  <option value="OTHER">Khác</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>Ngày sinh</Label>
                <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} disabled={!canEdit || pending} />
              </div>
              <div className="space-y-1">
                <Label>Ngày mất</Label>
                <Input type="date" value={dod} onChange={(e) => setDod(e.target.value)} disabled={!canEdit || pending} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Tiểu sử / ghi chú</Label>
              <Textarea value={bio} onChange={(e) => setBio(e.target.value)} disabled={!canEdit || pending} />
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                <div className="text-xs uppercase tracking-wide text-slate-500">Giới tính</div>
                <div className="mt-1 font-semibold text-slate-900">{genderLabel(member.gender)}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                <div className="text-xs uppercase tracking-wide text-slate-500">Cha</div>
                <div className="mt-1 font-semibold text-slate-900">{fatherLinks.length}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                <div className="text-xs uppercase tracking-wide text-slate-500">Mẹ</div>
                <div className="mt-1 font-semibold text-slate-900">{motherLinks.length}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                <div className="text-xs uppercase tracking-wide text-slate-500">Đời sống gia đình</div>
                <div className="mt-1 font-semibold text-slate-900">{currentPartnerRelations.length > 0 ? "Đang có hôn phối hiện tại" : formerPartnerRelations.length > 0 ? "Có lịch sử hôn phối" : "Chưa có hôn phối"}</div>
              </div>
            </div>

            {canEdit ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={pending}
                  onClick={() => startTransition(async () => {
                    await runAndRefresh(() => updateMemberAction({
                      id: member.id,
                      fullName,
                      gender,
                      dob: dob || null,
                      dod: dod || null,
                      bio: bio || null,
                    }));
                  })}
                >
                  {pending ? "Đang lưu..." : "Lưu thay đổi"}
                </Button>
                <Button
                  variant="outline"
                  disabled={pending}
                  onClick={() => {
                    const ok = confirm("Xóa thành viên này? Các quan hệ liên quan cũng sẽ bị gỡ.");
                    if (!ok) return;
                    startTransition(async () => {
                      const res = await deleteMemberAction(member.id);
                      if (!res.ok) {
                        setError(res.error ?? "Không thể xóa thành viên");
                        return;
                      }
                      router.push("/members");
                      router.refresh();
                    });
                  }}
                >
                  Xóa thành viên
                </Button>
              </div>
            ) : (
              <p className="text-sm text-slate-600">Bạn chỉ có quyền xem. Chỉnh sửa hồ sơ thuộc về quản trị viên hoặc quản lý dòng họ.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><div className="font-semibold">Tài khoản liên kết</div></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {linkedAccount ? (
              <>
                <div><span className="text-slate-500">Email:</span> {linkedAccount.email}</div>
                <div><span className="text-slate-500">Tên tài khoản:</span> {linkedAccount.full_name ?? "-"}</div>
                <div><span className="text-slate-500">Vai trò:</span> {roleLabel(linkedAccount.role)}</div>
                {canEdit ? <Link href="/admin/users-roles" className="text-xs underline">Mở trang người dùng & hồ sơ</Link> : null}
              </>
            ) : pendingInvitation ? (
              <div className="space-y-2 text-slate-600">
                <p>Hồ sơ này đang chờ người được mời tạo hoặc nhận tài khoản.</p>
                <div><span className="text-slate-500">Email mời:</span> {pendingInvitation.email}</div>
                <div><span className="text-slate-500">Hết hạn:</span> {formatDate(pendingInvitation.expires_at)}</div>
                <div className="flex flex-wrap gap-2">
                  {pendingInvitation.token ? (
                    <Button type="button" variant="outline" onClick={() => navigator.clipboard.writeText(getJoinLink(pendingInvitation.token!))}>Sao chép link mời</Button>
                  ) : null}
                  {canEdit ? <Link href={`/admin/users-roles?memberId=${member.id}`} className="text-xs underline">Đổi email hoặc mời lại</Link> : null}
                </div>
              </div>
            ) : (
              <div className="space-y-2 text-slate-600">
                <p>Hồ sơ này chưa được gắn với tài khoản đăng nhập nào.</p>
                {canEdit ? <Link href={`/admin/users-roles?memberId=${member.id}`} className="text-xs underline">Mời hoặc gắn tài khoản ngay</Link> : null}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><div className="font-semibold">Quan hệ gia đình và nghiệp vụ cây gia phả</div></CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Quy ước nâng cấp: cha dượng / mẹ kế / con riêng là quan hệ suy ra từ lịch sử hôn phối hiện tại + liên kết cha mẹ ruột; con nuôi được lưu tường minh;
            phối ngẫu cũ được lưu lịch sử với trạng thái ly hôn, ly thân hoặc góa để khi tái hôn hệ thống vẫn giải thích được nhánh gia đình cũ và mới.
          </div>

          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-8">
            {[
              ["Cha", String(fatherLinks.length)],
              ["Mẹ", String(motherLinks.length)],
              ["Phối ngẫu hiện tại", String(currentPartnerRelations.length)],
              ["Phối ngẫu cũ", String(formerPartnerRelations.length)],
              ["Con ruột", String(familyContext.biologicalChildren.length)],
              ["Con nuôi", String(familyContext.adoptedChildren.length)],
              ["Con riêng bên phối ngẫu", String(familyContext.spouseChildren.length)],
              ["Cha/mẹ còn lại của các con", String(familyContext.coParents.length)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">{value}</div>
              </div>
            ))}
          </div>

          <div>
            <div className="mb-1 font-medium">Cha</div>
            {fatherLinks.length === 0 ? <p className="text-sm text-slate-600">Chưa liên kết cha.</p> : (
              <ul className="list-disc pl-5 text-sm">
                {fatherLinks.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Link className="underline" href={`/members/${p.id}`}>{p.full_name}</Link>
                      {relationChip(parentRoleLabel(p.parent_role))}
                      {relationChip(childLinkTypeLabel(p.child_link_type))}
                    </div>
                    {canEdit ? (
                      <Button size="sm" variant="outline" onClick={() => startTransition(async () => {
                        await runAndRefresh(() => removeParentChildAction({ parentId: p.id, childId: member.id }));
                      })}>
                        Gỡ liên kết
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {canEdit ? (
              <div className="mt-2 space-y-2">
                {relationshipGuardrails.fatherLinked ? <p className="text-xs text-slate-500">Đã có cha, hãy gỡ liên kết cũ nếu cần thay thế.</p> : null}
                <div className="flex gap-2">
                  <select
                    disabled={relationshipGuardrails.parentSlotsFull || relationshipGuardrails.fatherLinked}
                    className="h-10 flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm disabled:opacity-50"
                    value={pickFather}
                    onChange={(e) => setPickFather(e.target.value)}
                  >
                    <option value="">Chọn thành viên nam làm cha</option>
                    {relationshipGuardrails.fatherCandidates.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                  </select>
                  <Button variant="outline" disabled={!pickFather || pending || relationshipGuardrails.parentSlotsFull || relationshipGuardrails.fatherLinked} onClick={() => startTransition(async () => {
                    await runAndRefresh(() => addParentChildAction({ parentId: pickFather, childId: member.id, parentRole: "FATHER", childLinkType: "BIOLOGICAL" }));
                    setPickFather("");
                  })}>Thêm cha</Button>
                </div>
              </div>
            ) : null}
          </div>

          <Separator />

          <div>
            <div className="mb-1 font-medium">Mẹ</div>
            {motherLinks.length === 0 ? <p className="text-sm text-slate-600">Chưa liên kết mẹ.</p> : (
              <ul className="list-disc pl-5 text-sm">
                {motherLinks.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Link className="underline" href={`/members/${p.id}`}>{p.full_name}</Link>
                      {relationChip(parentRoleLabel(p.parent_role))}
                      {relationChip(childLinkTypeLabel(p.child_link_type))}
                    </div>
                    {canEdit ? (
                      <Button size="sm" variant="outline" onClick={() => startTransition(async () => {
                        await runAndRefresh(() => removeParentChildAction({ parentId: p.id, childId: member.id }));
                      })}>
                        Gỡ liên kết
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {canEdit ? (
              <div className="mt-2 space-y-2">
                {relationshipGuardrails.motherLinked ? <p className="text-xs text-slate-500">Đã có mẹ, hãy gỡ liên kết cũ nếu cần thay thế.</p> : null}
                <div className="flex gap-2">
                  <select
                    disabled={relationshipGuardrails.parentSlotsFull || relationshipGuardrails.motherLinked}
                    className="h-10 flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm disabled:opacity-50"
                    value={pickMother}
                    onChange={(e) => setPickMother(e.target.value)}
                  >
                    <option value="">Chọn thành viên nữ làm mẹ</option>
                    {relationshipGuardrails.motherCandidates.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                  </select>
                  <Button variant="outline" disabled={!pickMother || pending || relationshipGuardrails.parentSlotsFull || relationshipGuardrails.motherLinked} onClick={() => startTransition(async () => {
                    await runAndRefresh(() => addParentChildAction({ parentId: pickMother, childId: member.id, parentRole: "MOTHER", childLinkType: "BIOLOGICAL" }));
                    setPickMother("");
                  })}>Thêm mẹ</Button>
                </div>
              </div>
            ) : null}
          </div>

          {legacyParentLinks.length > 0 ? (
            <>
              <Separator />
              <div>
                <div className="mb-1 font-medium">Liên kết cha/mẹ cũ cần chuẩn hóa</div>
                <p className="mb-2 text-xs text-amber-700">Các liên kết dưới đây được tạo từ phiên bản cũ chưa phân vai trò cha hoặc mẹ. Hãy gỡ ra rồi liên kết lại đúng vai trò để cây gia phả nhất quán.</p>
                <ul className="list-disc pl-5 text-sm">
                  {legacyParentLinks.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Link className="underline" href={`/members/${p.id}`}>{p.full_name}</Link>
                        {relationChip(parentRoleLabel(p.parent_role))}
                      </div>
                      {canEdit ? (
                        <Button size="sm" variant="outline" onClick={() => startTransition(async () => {
                          await runAndRefresh(() => removeParentChildAction({ parentId: p.id, childId: member.id }));
                        })}>
                          Gỡ liên kết
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : null}

          <Separator />

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <div className="mb-1 font-medium">Con ruột</div>
              {familyContext.biologicalChildren.length === 0 ? <p className="text-sm text-slate-600">Chưa liên kết con ruột.</p> : (
                <ul className="list-disc pl-5 text-sm">
                  {familyContext.biologicalChildren.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2"><Link className="underline" href={`/members/${c.id}`}>{c.full_name}</Link>{relationChip("Con ruột")}</div>
                      {canEdit ? <Button size="sm" variant="outline" onClick={() => startTransition(async () => {
                        await runAndRefresh(() => removeParentChildAction({ parentId: member.id, childId: c.id }));
                      })}>Gỡ liên kết</Button> : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <div className="mb-1 font-medium">Con nuôi</div>
              {familyContext.adoptedChildren.length === 0 ? <p className="text-sm text-slate-600">Chưa liên kết con nuôi.</p> : (
                <ul className="list-disc pl-5 text-sm">
                  {familyContext.adoptedChildren.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2"><Link className="underline" href={`/members/${c.id}`}>{c.full_name}</Link>{relationChip("Con nuôi")}</div>
                      {canEdit ? <Button size="sm" variant="outline" onClick={() => startTransition(async () => {
                        await runAndRefresh(() => removeParentChildAction({ parentId: member.id, childId: c.id }));
                      })}>Gỡ liên kết</Button> : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          {canEdit ? (
            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
              {!selfParentRole ? <p className="text-xs text-amber-700">Muốn thêm con từ hồ sơ này, bạn phải cập nhật giới tính của thành viên thành Nam hoặc Nữ để hệ thống xác định rõ vai trò cha hoặc mẹ.</p> : null}
              <div className="grid gap-2 md:grid-cols-[1fr_160px_auto]">
                <select disabled={!selfParentRole} className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm disabled:opacity-50" value={pickChild} onChange={(e) => setPickChild(e.target.value)}>
                  <option value="">Chọn người con để liên kết</option>
                  {relationshipGuardrails.childCandidates.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                </select>
                <select disabled={!selfParentRole} className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm disabled:opacity-50" value={pickChildLinkType} onChange={(e) => setPickChildLinkType(e.target.value as "BIOLOGICAL" | "ADOPTED")}>
                  <option value="BIOLOGICAL">Con ruột</option>
                  <option value="ADOPTED">Con nuôi</option>
                </select>
                <Button variant="outline" disabled={!pickChild || pending || !selfParentRole} onClick={() => startTransition(async () => {
                  await runAndRefresh(() => addParentChildAction({ parentId: member.id, childId: pickChild, parentRole: selfParentRole!, childLinkType: pickChildLinkType }));
                  setPickChild("");
                  setPickChildLinkType("BIOLOGICAL");
                })}>{selfParentRole === "FATHER" ? "Thêm con với vai trò cha" : selfParentRole === "MOTHER" ? "Thêm con với vai trò mẹ" : "Thêm"}</Button>
              </div>
            </div>
          ) : null}

          <Separator />

          <div>
            <div className="mb-1 font-medium">Hôn phối hiện tại</div>
            {currentPartnerRelations.length === 0 ? <p className="text-sm text-slate-600">Chưa có phối ngẫu hiện tại.</p> : (
              <ul className="space-y-3 text-sm">
                {currentPartnerRelations.map((item) => (
                  <li key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Link className="underline" href={item.other ? `/members/${item.other.id}` : "#"}>{item.other?.full_name ?? "Không rõ"}</Link>
                        {partnerStatusChip(item.relationship_status)}
                        {relationChip(partnerKindLabel(item.relationship_kind))}
                      </div>
                      {canEdit ? (
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => startTransition(async () => {
                            await runAndRefresh(() => closePartnerRelationshipAction({
                              memberId: member.id,
                              partnerId: item.other?.id,
                              closeStatus,
                              endedOn: closeEndedOn || null,
                              note: closeNote || null,
                            }));
                            setCloseEndedOn("");
                            setCloseNote("");
                          })}>Kết thúc quan hệ</Button>
                          <Button size="sm" variant="outline" onClick={() => startTransition(async () => {
                            await runAndRefresh(() => removeSpouseAction({ memberId: member.id, spouseId: item.other?.id }));
                          })}>Gỡ cứng (sửa sai dữ liệu)</Button>
                        </div>
                      ) : null}
                    </div>
                    <div className="mt-2 text-xs text-slate-600">Bắt đầu: {formatDate(item.started_on)}{item.note ? ` • ${item.note}` : ""}</div>
                  </li>
                ))}
              </ul>
            )}

            {canEdit ? (
              <div className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Mô hình mới cho phép giữ lịch sử hôn phối. Khi tái hôn, bạn không xóa dữ liệu cũ mà kết thúc quan hệ hiện tại bằng trạng thái phù hợp rồi mới tạo quan hệ mới.</p>
                {relationshipGuardrails.spouseSlotTaken ? <p className="text-xs text-amber-700">Thành viên này đang có phối ngẫu hiện tại. Hãy kết thúc quan hệ hiện tại trước khi tạo quan hệ mới.</p> : null}
                <div className="grid gap-2 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label>Thêm phối ngẫu hiện tại</Label>
                    <select disabled={relationshipGuardrails.spouseSlotTaken} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm disabled:opacity-50" value={pickSpouse} onChange={(e) => setPickSpouse(e.target.value)}>
                      <option value="">Chọn người để liên kết hôn phối</option>
                      {relationshipGuardrails.spouseCandidates.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label>Ngày bắt đầu</Label>
                    <Input type="date" value={pickSpouseStartedOn} onChange={(e) => setPickSpouseStartedOn(e.target.value)} disabled={relationshipGuardrails.spouseSlotTaken} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Ghi chú hôn phối</Label>
                  <Input value={pickSpouseNote} onChange={(e) => setPickSpouseNote(e.target.value)} disabled={relationshipGuardrails.spouseSlotTaken} placeholder="Ví dụ: tái hôn, hôn nhân đời 2, hợp thức hóa hồ sơ" />
                </div>
                <Button variant="outline" disabled={!pickSpouse || pending || relationshipGuardrails.spouseSlotTaken} onClick={() => startTransition(async () => {
                  await runAndRefresh(() => addPartnerRelationshipAction({
                    memberId: member.id,
                    partnerId: pickSpouse,
                    startedOn: pickSpouseStartedOn || null,
                    note: pickSpouseNote || null,
                    relationshipKind: "MARRIAGE",
                  }));
                  setPickSpouse("");
                  setPickSpouseStartedOn("");
                  setPickSpouseNote("");
                })}>Tạo hôn phối hiện tại</Button>

                {currentPartnerRelations.length > 0 ? (
                  <div className="grid gap-2 md:grid-cols-3">
                    <div className="space-y-1">
                      <Label>Trạng thái kết thúc</Label>
                      <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" value={closeStatus} onChange={(e) => setCloseStatus(partnerCloseStatusEnum.parse(e.target.value))}>
                        <option value="DIVORCED">Ly hôn</option>
                        <option value="SEPARATED">Ly thân</option>
                        <option value="WIDOWED">Góa</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label>Ngày kết thúc</Label>
                      <Input type="date" value={closeEndedOn} onChange={(e) => setCloseEndedOn(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label>Ghi chú kết thúc</Label>
                      <Input value={closeNote} onChange={(e) => setCloseNote(e.target.value)} placeholder="Lý do / bối cảnh" />
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {formerPartnerRelations.length > 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="font-medium text-slate-900">Lịch sử hôn phối</div>
              <ul className="mt-3 space-y-3 text-sm">
                {formerPartnerRelations.map((item) => (
                  <li key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link className="underline" href={item.other ? `/members/${item.other.id}` : "#"}>{item.other?.full_name ?? "Không rõ"}</Link>
                      {partnerStatusChip(item.relationship_status)}
                      {relationChip(partnerKindLabel(item.relationship_kind))}
                    </div>
                    <div className="mt-2 text-xs text-slate-600">Bắt đầu: {formatDate(item.started_on)} • Kết thúc: {formatDate(item.ended_on)}</div>
                    {item.note ? <div className="mt-1 text-xs text-slate-600">{item.note}</div> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {familyContext.spouseChildren.length > 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <div className="text-sm font-medium text-amber-900">Con riêng bên phối ngẫu hiện tại</div>
              <p className="mt-1 text-xs text-amber-800">Đây là các con ruột hoặc con nuôi của phối ngẫu hiện tại nhưng chưa có liên kết cha/mẹ trực tiếp với người đang xem. Trên cây, nhóm này phải hiện bằng nét nối đứt trong blended family.</p>
              <ul className="mt-2 list-disc pl-5 text-sm text-amber-900">
                {familyContext.spouseChildren.map((s) => (
                  <li key={s.id}><Link className="underline" href={`/members/${s.id}`}>{s.full_name}</Link></li>
                ))}
              </ul>
            </div>
          ) : null}

          {familyContext.coParents.length > 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-sm font-medium text-slate-900">Cha / mẹ còn lại của các con đã liên kết</div>
              <ul className="mt-2 list-disc pl-5 text-sm text-slate-700">
                {familyContext.coParents.map((s) => (
                  <li key={s.id}><Link className="underline" href={`/members/${s.id}`}>{s.full_name}</Link></li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
