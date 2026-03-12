import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/context";
import { createSupabaseServerComponentClient } from "@/lib/supabase/server";
import { MemberDetailClient } from "./MemberDetailClient";
import { assertSupabaseQuery } from "@/lib/supabase/assert";

type MemberLinkingRow = {
  member_id: string;
  member_name: string;
  linked_user_id: string | null;
  linked_email: string | null;
  linked_account_name: string | null;
  linked_role: string | null;
  pending_invitation_id: string | null;
  pending_invitation_email: string | null;
  pending_invitation_expires_at: string | null;
  pending_invitation_token: string | null;
};

type ParentRole = "FATHER" | "MOTHER" | "PARENT";
type ChildLinkType = "BIOLOGICAL" | "ADOPTED";
type PartnerRelationshipStatus = "CURRENT" | "DIVORCED" | "SEPARATED" | "WIDOWED";
type PartnerRelationshipKind = "MARRIAGE" | "PARTNERSHIP";

type MemberRow = {
  id: string;
  full_name: string;
  gender: "MALE" | "FEMALE" | "OTHER" | "UNKNOWN";
  dob: string | null;
  dod: string | null;
  bio: string | null;
};

type RelationMemberRow = { id: string; full_name: string; gender: MemberRow["gender"] | null };
type ParentChildEdge = { parent_id: string; child_id: string; parent_role: ParentRole | null; child_link_type: ChildLinkType | null };
type SpouseEdge = { member_a_id: string; member_b_id: string };
type ParentRow = RelationMemberRow & { parent_role: ParentRole | null; child_link_type: ChildLinkType | null };
type ChildRow = RelationMemberRow & { child_link_type: ChildLinkType | null };
type PartnerRelationshipRow = {
  id: string;
  member_a_id: string;
  member_b_id: string;
  relationship_kind: PartnerRelationshipKind;
  relationship_status: PartnerRelationshipStatus;
  started_on: string | null;
  ended_on: string | null;
  note: string | null;
};

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireAuth();
  const supabase = await createSupabaseServerComponentClient();
  const canEdit = ctx.role === "admin" || ctx.role === "clan_manager";

  const [memberRes, allMembersRes, allParentChildRes, allSpouseEdgesRes, partnerHistoryRes, linkedRes] = await Promise.all([
    supabase
      .from("members")
      .select("id,full_name,gender,dob,dod,bio")
      .eq("id", id)
      .eq("clan_id", ctx.activeClanId)
      .maybeSingle(),
    supabase
      .from("members")
      .select("id,full_name,gender")
      .eq("clan_id", ctx.activeClanId)
      .order("full_name", { ascending: true })
      .limit(5000),
    supabase
      .from("member_parent_child")
      .select("parent_id,child_id,parent_role,child_link_type")
      .eq("clan_id", ctx.activeClanId)
      .limit(20000),
    supabase
      .from("member_spouses")
      .select("member_a_id,member_b_id")
      .eq("clan_id", ctx.activeClanId)
      .limit(20000),
    supabase
      .from("member_partner_relationships")
      .select("id,member_a_id,member_b_id,relationship_kind,relationship_status,started_on,ended_on,note")
      .eq("clan_id", ctx.activeClanId)
      .or(`member_a_id.eq.${id},member_b_id.eq.${id}`)
      .order("created_at", { ascending: false })
      .limit(100),
    canEdit ? supabase.rpc("get_member_linking_admin") : Promise.resolve({ data: null, error: null }),
  ]);

  const member = assertSupabaseQuery("members.detail.member", memberRes.data as MemberRow | null, memberRes.error);
  const allMembers = assertSupabaseQuery("members.detail.allMembers", (allMembersRes.data ?? []) as RelationMemberRow[], allMembersRes.error);
  const allParentChild = assertSupabaseQuery(
    "members.detail.allParentChild",
    (allParentChildRes.data ?? []) as ParentChildEdge[],
    allParentChildRes.error
  );
  const allSpouseEdges = assertSupabaseQuery(
    "members.detail.allSpouseEdges",
    (allSpouseEdgesRes.data ?? []) as SpouseEdge[],
    allSpouseEdgesRes.error
  );
  const partnerHistory = assertSupabaseQuery(
    "members.detail.partnerHistory",
    (partnerHistoryRes.data ?? []) as PartnerRelationshipRow[],
    partnerHistoryRes.error
  );

  if (!member) return notFound();

  const memberById = new Map((allMembers ?? []).map((row) => [row.id, row]));

  const parents: ParentRow[] = [];
  for (const edge of allParentChild ?? []) {
    if (edge.child_id !== id) continue;
    const parent = memberById.get(edge.parent_id);
    if (!parent) continue;
    parents.push({ ...parent, parent_role: edge.parent_role, child_link_type: edge.child_link_type });
  }

  const children: ChildRow[] = [];
  for (const edge of allParentChild ?? []) {
    if (edge.parent_id !== id) continue;
    const child = memberById.get(edge.child_id);
    if (!child) continue;
    children.push({ ...child, child_link_type: edge.child_link_type });
  }

  const spouseIds = new Set<string>();
  for (const e of allSpouseEdges ?? []) {
    if (e.member_a_id === id) spouseIds.add(e.member_b_id);
    if (e.member_b_id === id) spouseIds.add(e.member_a_id);
  }
  const spouses = (allMembers ?? []).filter((m) => spouseIds.has(m.id));

  const linkedAccount = ((linkedRes.data ?? []) as MemberLinkingRow[]).find((row) => row.member_id === id) ?? null;

  return (
    <MemberDetailClient
      canEdit={canEdit}
      member={{
        id: member.id,
        full_name: member.full_name,
        gender: member.gender,
        dob: member.dob,
        dod: member.dod,
        bio: member.bio,
      }}
      linkedAccount={linkedAccount?.linked_user_id ? { email: linkedAccount.linked_email ?? "", full_name: linkedAccount.linked_account_name ?? null, role: linkedAccount.linked_role ?? "member" } : null}
      pendingInvitation={linkedAccount?.pending_invitation_id ? { email: linkedAccount.pending_invitation_email ?? "", expires_at: linkedAccount.pending_invitation_expires_at ?? null, token: linkedAccount.pending_invitation_token ?? null } : null}
      allMembers={(allMembers ?? []).map((m) => ({ id: m.id, full_name: m.full_name, gender: m.gender }))}
      parents={parents}
      children={children}
      spouses={spouses.map((m) => ({ id: m.id, full_name: m.full_name, gender: m.gender }))}
      allParentChild={allParentChild ?? []}
      partnerHistory={partnerHistory ?? []}
    />
  );
}
