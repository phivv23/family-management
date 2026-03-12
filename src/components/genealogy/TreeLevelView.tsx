"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Member = {
  id: string;
  full_name: string;
  gender: string;
  dob: string | null;
  dod: string | null;
};

type ParentChild = {
  parent_id: string;
  child_id: string;
  child_link_type?: "BIOLOGICAL" | "ADOPTED" | null;
};

type Spouse = { member_a_id: string; member_b_id: string };

type PartnerHistory = {
  id: string;
  member_a_id: string;
  member_b_id: string;
  relationship_status: "CURRENT" | "DIVORCED" | "SEPARATED" | "WIDOWED";
  started_on: string | null;
  ended_on: string | null;
  note: string | null;
};

type FormerPartnerInfo = {
  otherId: string;
  status: Exclude<PartnerHistory["relationship_status"], "CURRENT">;
  started_on: string | null;
  ended_on: string | null;
  note: string | null;
};

type Node = {
  id: string;
  member: Member;
  spouseIds: string[];
  children: string[];
  parents: string[];
};

type RowUnit = {
  ids: string[];
  depth: number;
  width: number;
  x: number;
  pivotId: string | null;
  offsets: number[];
};

type PositionedMember = {
  id: string;
  depth: number;
  x: number;
  y: number;
};

type ViewMode = "poster" | "families" | "generations";
type ScopeMode = "all" | "focused";

type LayoutData = {
  visibleMembers: Member[];
  rows: Array<{ depth: number; units: RowUnit[] }>;
  positioned: Map<string, PositionedMember>;
  canvasWidth: number;
  canvasHeight: number;
  visibleSet: Set<string>;
  partnerSlotByMember: Map<string, string>;
};

const CARD_WIDTH = 170;
const NODE_HEIGHT = 184;
const AVATAR_SIZE = 52;
const CARD_TOP = 24;
const COUPLE_GAP = 18;
const MULTI_PARTNER_GAP = 42;
const UNIT_GAP = 36;
const LEVEL_GAP = 88;
const DEFAULT_VIEWPORT_HEIGHT = 780;

function normalize(s: string) {
  return s.toLowerCase().trim();
}

function pairKey(a: string, b: string) {
  return [a, b].sort().join("|");
}

function yearValue(date: string | null | undefined, fallback: number) {
  const value = Number(date?.slice(0, 4));
  return Number.isFinite(value) ? value : fallback;
}

function birthYear(member: Member | undefined | null) {
  return yearValue(member?.dob, 9999);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function buildUnitOffsets(ids: string[], pivotId: string | null) {
  if (ids.length === 0) return [] as number[];
  const offsets: number[] = [0];
  const pivotIndex = pivotId ? ids.indexOf(pivotId) : -1;

  for (let index = 1; index < ids.length; index += 1) {
    const previousIndex = index - 1;
    const hasPivotBetween = pivotIndex >= 0 && (previousIndex === pivotIndex || index === pivotIndex);
    const gap = hasPivotBetween ? MULTI_PARTNER_GAP : COUPLE_GAP;
    offsets[index] = offsets[previousIndex] + CARD_WIDTH + gap;
  }

  return offsets;
}

function isInteractiveTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest('[data-no-drag="true"]'));
}

function formatLife(member: Member) {
  const dobYear = member.dob?.slice(0, 4) ?? null;
  const dodYear = member.dod?.slice(0, 4) ?? null;
  if (dobYear && dodYear) return `${dobYear} — ${dodYear}`;
  if (dobYear) return `Sinh ${dobYear}`;
  if (dodYear) return `Mất ${dodYear}`;
  return "Chưa cập nhật năm sinh / năm mất";
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(-2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "TV";
}

function toneClass(gender: string) {
  if (gender === "MALE") return "bg-amber-100 text-amber-950 border-amber-200";
  if (gender === "FEMALE") return "bg-rose-100 text-rose-950 border-rose-200";
  return "bg-emerald-100 text-emerald-950 border-emerald-200";
}

function relationRoleLabel(role: string, gender: string) {
  if (role === "focus") return "Trung tâm";
  if (role === "spouse") return gender === "MALE" ? "Chồng" : gender === "FEMALE" ? "Vợ" : "Vợ / chồng";
  if (role === "father") return "Cha";
  if (role === "mother") return "Mẹ";
  if (role === "child") return "Con";
  if (role === "sibling") return "Anh / chị / em";
  if (role === "step_parent") return gender === "MALE" ? "Cha dượng" : gender === "FEMALE" ? "Mẹ kế" : "Phụ huynh ghép";
  if (role === "step_child") return "Con riêng bên vợ/chồng";
  if (role === "former_spouse") return "Phối ngẫu cũ";
  if (role === "adopted_child") return "Con nuôi";
  if (role === "son_in_law") return "Con rể";
  if (role === "daughter_in_law") return "Con dâu";
  if (role === "coparent") return "Cha / mẹ của con";
  return "Thành viên";
}

function partnerStatusLabel(status: Exclude<PartnerHistory["relationship_status"], "CURRENT">) {
  if (status === "DIVORCED") return "Ly hôn";
  if (status === "SEPARATED") return "Ly thân";
  return "Góa";
}

function buildGraph(members: Member[], parentChild: ParentChild[], spouses: Spouse[], partnerHistory: PartnerHistory[]) {
  const childrenByParent = new Map<string, string[]>();
  const parentsByChild = new Map<string, string[]>();
  const spouseById = new Map<string, Set<string>>();
  const formerPartnerById = new Map<string, FormerPartnerInfo[]>();

  for (const edge of parentChild) {
    const children = childrenByParent.get(edge.parent_id) ?? [];
    children.push(edge.child_id);
    childrenByParent.set(edge.parent_id, children);

    const parents = parentsByChild.get(edge.child_id) ?? [];
    parents.push(edge.parent_id);
    parentsByChild.set(edge.child_id, parents);
  }

  for (const edge of spouses) {
    if (!spouseById.get(edge.member_a_id)) spouseById.set(edge.member_a_id, new Set());
    if (!spouseById.get(edge.member_b_id)) spouseById.set(edge.member_b_id, new Set());
    spouseById.get(edge.member_a_id)?.add(edge.member_b_id);
    spouseById.get(edge.member_b_id)?.add(edge.member_a_id);
  }

  for (const item of partnerHistory) {
    if (item.relationship_status === "CURRENT") continue;
    const left = formerPartnerById.get(item.member_a_id) ?? [];
    left.push({
      otherId: item.member_b_id,
      status: item.relationship_status,
      started_on: item.started_on,
      ended_on: item.ended_on,
      note: item.note,
    });
    formerPartnerById.set(item.member_a_id, left);

    const right = formerPartnerById.get(item.member_b_id) ?? [];
    right.push({
      otherId: item.member_a_id,
      status: item.relationship_status,
      started_on: item.started_on,
      ended_on: item.ended_on,
      note: item.note,
    });
    formerPartnerById.set(item.member_b_id, right);
  }

  const nodeMap = new Map<string, Node>();
  for (const member of members) {
    nodeMap.set(member.id, {
      id: member.id,
      member,
      spouseIds: Array.from(spouseById.get(member.id) ?? []),
      children: childrenByParent.get(member.id) ?? [],
      parents: parentsByChild.get(member.id) ?? [],
    });
  }

  return { childrenByParent, parentsByChild, spouseById, formerPartnerById, nodeMap };
}

function collectReachable(startId: string, adjacency: Map<string, string[]>) {
  const seen = new Set<string>();
  const queue = [...(adjacency.get(startId) ?? [])];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || seen.has(current)) continue;
    seen.add(current);
    queue.push(...(adjacency.get(current) ?? []));
  }
  return seen;
}

function computeFocusSummary(
  focusId: string,
  nodeMap: Map<string, Node>,
  childrenByParent: Map<string, string[]>,
  parentsByChild: Map<string, string[]>,
  parentChild: ParentChild[],
  partnerHistory: PartnerHistory[]
) {
  const focusNode = nodeMap.get(focusId);
  if (!focusNode) {
    return {
      parentIds: [] as string[],
      spouseIds: [] as string[],
      formerPartnerIds: [] as string[],
      childIds: [] as string[],
      adoptedChildIds: [] as string[],
      siblingIds: [] as string[],
      stepParentIds: [] as string[],
      stepChildIds: [] as string[],
      coParentIds: [] as string[],
    };
  }

  const siblingIds = new Set<string>();
  for (const parentId of focusNode.parents) {
    for (const childId of childrenByParent.get(parentId) ?? []) {
      if (childId !== focusId) siblingIds.add(childId);
    }
  }

  const stepParentIds = new Set<string>();
  for (const parentId of focusNode.parents) {
    for (const spouseId of nodeMap.get(parentId)?.spouseIds ?? []) {
      if (!focusNode.parents.includes(spouseId)) stepParentIds.add(spouseId);
    }
  }

  const stepChildIds = new Set<string>();
  for (const spouseId of focusNode.spouseIds) {
    for (const childId of childrenByParent.get(spouseId) ?? []) {
      if (!focusNode.children.includes(childId)) stepChildIds.add(childId);
    }
  }

  const coParentIds = new Set<string>();
  for (const childId of focusNode.children) {
    for (const parentId of parentsByChild.get(childId) ?? []) {
      if (parentId !== focusId) coParentIds.add(parentId);
    }
  }

  const adoptedChildIds = new Set(
    parentChild
      .filter((edge) => edge.parent_id === focusId && edge.child_link_type === "ADOPTED")
      .map((edge) => edge.child_id)
  );

  const formerPartnerIds = new Set<string>();
  for (const item of partnerHistory) {
    if (item.relationship_status === "CURRENT") continue;
    if (item.member_a_id === focusId) formerPartnerIds.add(item.member_b_id);
    if (item.member_b_id === focusId) formerPartnerIds.add(item.member_a_id);
  }

  return {
    parentIds: focusNode.parents,
    spouseIds: focusNode.spouseIds,
    formerPartnerIds: [...formerPartnerIds],
    childIds: focusNode.children,
    adoptedChildIds: [...adoptedChildIds],
    siblingIds: [...siblingIds],
    stepParentIds: [...stepParentIds],
    stepChildIds: [...stepChildIds],
    coParentIds: [...coParentIds],
  };
}

function relationLabelForMember(
  memberId: string,
  focusId: string,
  nodeMap: Map<string, Node>,
  childrenByParent: Map<string, string[]>,
  parentsByChild: Map<string, string[]>,
  adoptedChildIds: Set<string>,
  formerPartnerIds: Set<string>
) {
  const focusNode = nodeMap.get(focusId);
  const member = nodeMap.get(memberId)?.member;
  if (!focusNode || !member) return relationRoleLabel("other", "UNKNOWN");
  if (memberId === focusId) return relationRoleLabel("focus", member.gender);
  if (focusNode.spouseIds.includes(memberId)) return relationRoleLabel("spouse", member.gender);
  if (formerPartnerIds.has(memberId)) return relationRoleLabel("former_spouse", member.gender);
  if (focusNode.parents.includes(memberId)) {
    return relationRoleLabel(member.gender === "MALE" ? "father" : member.gender === "FEMALE" ? "mother" : "other", member.gender);
  }
  if (focusNode.children.includes(memberId)) {
    return relationRoleLabel(adoptedChildIds.has(memberId) ? "adopted_child" : "child", member.gender);
  }

  const siblings = new Set<string>();
  for (const parentId of focusNode.parents) {
    for (const childId of childrenByParent.get(parentId) ?? []) {
      if (childId !== focusId) siblings.add(childId);
    }
  }
  if (siblings.has(memberId)) return relationRoleLabel("sibling", member.gender);

  for (const parentId of focusNode.parents) {
    for (const spouseId of nodeMap.get(parentId)?.spouseIds ?? []) {
      if (spouseId === memberId && !focusNode.parents.includes(spouseId)) {
        return relationRoleLabel("step_parent", member.gender);
      }
    }
  }

  for (const spouseId of focusNode.spouseIds) {
    for (const childId of childrenByParent.get(spouseId) ?? []) {
      if (childId === memberId && !focusNode.children.includes(memberId)) {
        return relationRoleLabel("step_child", member.gender);
      }
    }
  }

  for (const childId of focusNode.children) {
    const childNode = nodeMap.get(childId);
    if (childNode?.spouseIds.includes(memberId)) {
      return relationRoleLabel(childNode.member.gender === "MALE" ? "daughter_in_law" : childNode.member.gender === "FEMALE" ? "son_in_law" : "other", member.gender);
    }
  }

  for (const childId of focusNode.children) {
    for (const parentId of parentsByChild.get(childId) ?? []) {
      if (parentId === memberId && parentId !== focusId) {
        return relationRoleLabel("coparent", member.gender);
      }
    }
  }

  const ancestors = collectReachable(focusId, parentsByChild);
  const descendants = collectReachable(focusId, childrenByParent);
  if (ancestors.has(memberId)) return "Tổ tiên";
  if (descendants.has(memberId)) return "Hậu duệ";

  return relationRoleLabel("other", member.gender);
}

function HouseholdList({
  title,
  ids,
  nodeMap,
  focusId,
  onFocus,
  childrenByParent,
  parentsByChild,
  adoptedChildIds,
  formerPartnerIds,
}: {
  title: string;
  ids: string[];
  nodeMap: Map<string, Node>;
  focusId: string;
  onFocus: (id: string) => void;
  childrenByParent: Map<string, string[]>;
  parentsByChild: Map<string, string[]>;
  adoptedChildIds: Set<string>;
  formerPartnerIds: Set<string>;
}) {
  if (ids.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
        <div className="font-medium text-slate-700">{title}</div>
        <p className="mt-2">Chưa có liên kết.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="font-medium text-slate-900">{title}</div>
      <div className="mt-3 space-y-3">
        {ids.map((id) => {
          const node = nodeMap.get(id);
          if (!node) return null;
          return (
            <div key={id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="font-medium text-slate-900">{node.member.full_name}</div>
                  <div className="text-xs text-slate-500">
                    {relationLabelForMember(id, focusId, nodeMap, childrenByParent, parentsByChild, adoptedChildIds, formerPartnerIds)}
                  </div>
                </div>
                <button type="button" onClick={() => onFocus(id)} className="text-xs text-slate-700 underline underline-offset-2">
                  Lấy làm trung tâm
                </button>
              </div>
              <div className="mt-1 text-xs text-slate-500">{formatLife(node.member)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TreeLevelView({
  members,
  parentChild,
  spouses,
  partnerHistory,
  initialRootId,
  initialSelectedId,
}: {
  members: Member[];
  parentChild: ParentChild[];
  spouses: Spouse[];
  partnerHistory: PartnerHistory[];
  initialRootId: string | null;
  initialSelectedId?: string | null;
}) {
  const memberMap = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const graph = useMemo(() => buildGraph(members, parentChild, spouses, partnerHistory), [members, parentChild, spouses, partnerHistory]);
  const { nodeMap, parentsByChild, spouseById, formerPartnerById, childrenByParent } = graph;

  const relationshipMetaByPair = useMemo(() => {
    const map = new Map<string, { started_on: string | null; ended_on: string | null; isCurrent: boolean; hasHistory: boolean }>();

    for (const item of partnerHistory) {
      const key = pairKey(item.member_a_id, item.member_b_id);
      const current = map.get(key);
      const candidate = {
        started_on: item.started_on,
        ended_on: item.ended_on,
        isCurrent: item.relationship_status === "CURRENT",
        hasHistory: true,
      };

      if (!current) {
        map.set(key, candidate);
        continue;
      }

      const currentYear = yearValue(current.started_on, 9999);
      const candidateYear = yearValue(candidate.started_on, 9999);
      if (candidate.isCurrent && !current.isCurrent) {
        map.set(key, candidate);
      } else if (candidateYear < currentYear) {
        map.set(key, { ...candidate, isCurrent: current.isCurrent || candidate.isCurrent });
      } else if (!current.started_on && candidate.started_on) {
        map.set(key, { ...candidate, isCurrent: current.isCurrent || candidate.isCurrent });
      } else {
        map.set(key, { ...current, isCurrent: current.isCurrent || candidate.isCurrent, hasHistory: true });
      }
    }

    for (const edge of spouses) {
      const key = pairKey(edge.member_a_id, edge.member_b_id);
      if (!map.has(key)) {
        map.set(key, { started_on: null, ended_on: null, isCurrent: true, hasHistory: false });
      } else {
        const current = map.get(key)!;
        map.set(key, { ...current, isCurrent: true });
      }
    }

    return map;
  }, [partnerHistory, spouses]);

  const initialFocusId = initialSelectedId ?? initialRootId ?? members[0]?.id ?? "";
  const [focusId, setFocusId] = useState<string>(initialFocusId);
  const [query, setQuery] = useState<string>("");
  const [maxDepth, setMaxDepth] = useState<number>(99);
  const [viewMode, setViewMode] = useState<ViewMode>("poster");
  const [scopeMode, setScopeMode] = useState<ScopeMode>("all");
  const [showFormerInPoster, setShowFormerInPoster] = useState<boolean>(false);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set());
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 24, y: 24 });
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{ active: boolean; startX: number; startY: number; originX: number; originY: number }>({
    active: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
  });

  useEffect(() => {
    if (!focusId && members[0]?.id) setFocusId(members[0].id);
  }, [focusId, members]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('[data-action-menu="true"]')) return;
      setActionMenuId(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActionMenuId(null);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const allRootIds = useMemo(() => {
    const ids = members.map((member) => member.id);
    const roots = ids.filter((id) => (parentsByChild.get(id) ?? []).length === 0);
    return roots.length > 0 ? roots : ids;
  }, [members, parentsByChild]);

  const descendantCountById = useMemo(() => {
    const memo = new Map<string, number>();
    const dfs = (id: string, stack = new Set<string>()): number => {
      if (memo.has(id)) return memo.get(id)!;
      if (stack.has(id)) return 0;
      stack.add(id);
      const children = childrenByParent.get(id) ?? [];
      const count = children.reduce((sum, childId) => sum + 1 + dfs(childId, stack), 0);
      stack.delete(id);
      memo.set(id, count);
      return count;
    };
    members.forEach((member) => dfs(member.id));
    return memo;
  }, [childrenByParent, members]);

  const adoptedChildrenByParent = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const edge of parentChild) {
      if (edge.child_link_type !== "ADOPTED") continue;
      const current = map.get(edge.parent_id) ?? new Set<string>();
      current.add(edge.child_id);
      map.set(edge.parent_id, current);
    }
    return map;
  }, [parentChild]);

  const suggestions = useMemo(() => {
    const q = normalize(query);
    if (q.length < 2) return [];
    return members.filter((m) => normalize(m.full_name).includes(q)).slice(0, 10);
  }, [members, query]);

  const visibleData = useMemo<LayoutData>(() => {
    if (!focusId || !nodeMap.has(focusId)) {
      return {
        visibleMembers: [],
        rows: [],
        positioned: new Map<string, PositionedMember>(),
        canvasWidth: 0,
        canvasHeight: 0,
        visibleSet: new Set<string>(),
        partnerSlotByMember: new Map<string, string>(),
      };
    }

    const visibleSet = new Set<string>();
    const queue: Array<{ id: string; depth: number }> = [];
    const enqueued = new Set<string>();
    const depthLimit = maxDepth >= 99 ? Number.POSITIVE_INFINITY : maxDepth;

    const pushQueue = (id: string, depth: number) => {
      if (!nodeMap.has(id)) return;
      const key = `${id}:${depth}`;
      if (enqueued.has(key)) return;
      enqueued.add(key);
      queue.push({ id, depth });
    };

    if (scopeMode === "all") {
      for (const id of allRootIds) pushQueue(id, 0);
    } else {
      const ancestorSet = new Set<string>();
      const walkAncestors = (memberId: string, depth: number) => {
        if (depth > depthLimit) return;
        for (const parentId of parentsByChild.get(memberId) ?? []) {
          if (ancestorSet.has(parentId)) continue;
          ancestorSet.add(parentId);
          walkAncestors(parentId, depth + 1);
        }
      };
      walkAncestors(focusId, 0);
      const branchRoots = [...ancestorSet].filter((id) => {
        const parents = parentsByChild.get(id) ?? [];
        return parents.every((pid) => !ancestorSet.has(pid));
      });
      const roots = branchRoots.length > 0 ? branchRoots : [focusId];
      roots.forEach((id) => pushQueue(id, 0));
      ancestorSet.forEach((id) => visibleSet.add(id));
    }

    const focusPathSet = new Set<string>([focusId]);
    const walkFocusParents = (id: string) => {
      for (const parentId of parentsByChild.get(id) ?? []) {
        if (focusPathSet.has(parentId)) continue;
        focusPathSet.add(parentId);
        walkFocusParents(parentId);
      }
    };
    walkFocusParents(focusId);

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) break;
      visibleSet.add(current.id);

      for (const spouseId of spouseById.get(current.id) ?? []) {
        visibleSet.add(spouseId);
        pushQueue(spouseId, current.depth);
      }

      if (showFormerInPoster || viewMode !== "poster") {
        for (const former of formerPartnerById.get(current.id) ?? []) {
          visibleSet.add(former.otherId);
        }
      }

      if (current.depth >= depthLimit) continue;
      if (collapsedIds.has(current.id) && !focusPathSet.has(current.id)) continue;

      for (const childId of childrenByParent.get(current.id) ?? []) {
        visibleSet.add(childId);
        pushQueue(childId, current.depth + 1);
      }
    }

    for (const memberId of [...visibleSet]) {
      for (const parentId of parentsByChild.get(memberId) ?? []) visibleSet.add(parentId);
      for (const spouseId of spouseById.get(memberId) ?? []) visibleSet.add(spouseId);
      if (showFormerInPoster || viewMode !== "poster") {
        for (const former of formerPartnerById.get(memberId) ?? []) visibleSet.add(former.otherId);
      }
      for (const childId of childrenByParent.get(memberId) ?? []) {
        visibleSet.add(childId);
        for (const parentId of parentsByChild.get(childId) ?? []) visibleSet.add(parentId);
      }
    }

    const filteredNodeMap = new Map<string, Node>();
    for (const id of visibleSet) {
      const node = nodeMap.get(id);
      if (!node) continue;
      filteredNodeMap.set(id, {
        ...node,
        spouseIds: node.spouseIds.filter((sid) => visibleSet.has(sid)),
        children: node.children.filter((cid) => visibleSet.has(cid)),
        parents: node.parents.filter((pid) => visibleSet.has(pid)),
      });
    }

    const componentParentById = new Map<string, string>();
    const componentMembers = new Map<string, string[]>();

    const find = (id: string): string => {
      const current = componentParentById.get(id) ?? id;
      if (current === id) return current;
      const root = find(current);
      componentParentById.set(id, root);
      return root;
    };

    const union = (leftId: string, rightId: string) => {
      const leftRoot = find(leftId);
      const rightRoot = find(rightId);
      if (leftRoot === rightRoot) return;
      componentParentById.set(rightRoot, leftRoot);
    };

    for (const id of filteredNodeMap.keys()) componentParentById.set(id, id);
    for (const [id, node] of filteredNodeMap.entries()) {
      for (const spouseId of node.spouseIds) {
        if (filteredNodeMap.has(spouseId)) union(id, spouseId);
      }
      for (const former of formerPartnerById.get(id) ?? []) {
        if (filteredNodeMap.has(former.otherId)) union(id, former.otherId);
      }
    }

    for (const id of filteredNodeMap.keys()) {
      const root = find(id);
      const membersInComponent = componentMembers.get(root) ?? [];
      membersInComponent.push(id);
      componentMembers.set(root, membersInComponent);
    }

    const componentParents = new Map<string, Set<string>>();
    for (const [childId, node] of filteredNodeMap.entries()) {
      const childComponent = find(childId);
      for (const parentId of node.parents) {
        if (!filteredNodeMap.has(parentId)) continue;
        const parentComponent = find(parentId);
        if (parentComponent === childComponent) continue;
        if (!componentParents.has(childComponent)) componentParents.set(childComponent, new Set());
        componentParents.get(childComponent)?.add(parentComponent);
      }
    }

    const componentDepthMemo = new Map<string, number>();
    const calcComponentDepth = (componentId: string, stack = new Set<string>()): number => {
      if (componentDepthMemo.has(componentId)) return componentDepthMemo.get(componentId)!;
      if (stack.has(componentId)) return 0;
      stack.add(componentId);
      const parents = [...(componentParents.get(componentId) ?? [])];
      const value = parents.length === 0 ? 0 : Math.max(...parents.map((parentId) => calcComponentDepth(parentId, stack) + 1));
      componentDepthMemo.set(componentId, value);
      stack.delete(componentId);
      return value;
    };

    for (const componentId of componentMembers.keys()) calcComponentDepth(componentId);

    const depthMemo = new Map<string, number>();
    for (const [componentId, memberIds] of componentMembers.entries()) {
      const depth = componentDepthMemo.get(componentId) ?? 0;
      for (const memberId of memberIds) depthMemo.set(memberId, depth);
    }

    const levelMembers = new Map<number, string[]>();
    for (const id of filteredNodeMap.keys()) {
      const depth = depthMemo.get(id) ?? 0;
      const arr = levelMembers.get(depth) ?? [];
      arr.push(id);
      levelMembers.set(depth, arr);
    }

    const sortedDepths = [...levelMembers.keys()].sort((a, b) => a - b);
    const rows: Array<{ depth: number; units: RowUnit[] }> = [];
    const lastMemberOrderById = new Map<string, number>();
    const partnerSlotByMember = new Map<string, string>();

    const hasSharedChild = (leftId: string, rightId: string) => {
      const leftChildren = new Set(filteredNodeMap.get(leftId)?.children ?? []);
      return (filteredNodeMap.get(rightId)?.children ?? []).some((childId) => leftChildren.has(childId));
    };

    const getPairStartYear = (leftId: string, rightId: string) => {
      const meta = relationshipMetaByPair.get(pairKey(leftId, rightId));
      if (meta?.started_on) return yearValue(meta.started_on, 9999);
      const sharedChildren = (filteredNodeMap.get(leftId)?.children ?? []).filter((childId) =>
        (filteredNodeMap.get(rightId)?.children ?? []).includes(childId)
      );
      if (sharedChildren.length > 0) {
        const earliestChild = Math.min(...sharedChildren.map((childId) => birthYear(memberMap.get(childId))));
        if (Number.isFinite(earliestChild)) return earliestChild;
      }
      return Math.min(birthYear(memberMap.get(leftId)), birthYear(memberMap.get(rightId)), 9999);
    };

    for (const depth of sortedDepths) {
      const ids = [...(levelMembers.get(depth) ?? [])];
      ids.sort((a, b) => {
        const aParents = filteredNodeMap.get(a)?.parents ?? [];
        const bParents = filteredNodeMap.get(b)?.parents ?? [];
        const score = (parents: string[]) => {
          if (parents.length === 0) return Number.MAX_SAFE_INTEGER / 4;
          const valid = parents.map((pid) => lastMemberOrderById.get(pid)).filter((v): v is number => Number.isFinite(v));
          if (valid.length === 0) return Number.MAX_SAFE_INTEGER / 4;
          return valid.reduce((sum, item) => sum + item, 0) / valid.length;
        };
        const scoreA = score(aParents);
        const scoreB = score(bParents);
        if (scoreA !== scoreB) return scoreA - scoreB;

        const aBirth = birthYear(memberMap.get(a));
        const bBirth = birthYear(memberMap.get(b));
        if (aBirth !== bBirth) return bBirth - aBirth;

        return (filteredNodeMap.get(a)?.member.full_name ?? "").localeCompare(filteredNodeMap.get(b)?.member.full_name ?? "", "vi");
      });

      const idsSet = new Set(ids);
      const adjacency = new Map<string, Set<string>>();
      const addEdge = (leftId: string, rightId: string) => {
        if (!idsSet.has(leftId) || !idsSet.has(rightId) || leftId === rightId) return;
        if (!adjacency.has(leftId)) adjacency.set(leftId, new Set());
        if (!adjacency.has(rightId)) adjacency.set(rightId, new Set());
        adjacency.get(leftId)?.add(rightId);
        adjacency.get(rightId)?.add(leftId);
      };

      for (const id of ids) {
        for (const spouseId of filteredNodeMap.get(id)?.spouseIds ?? []) addEdge(id, spouseId);
        for (const former of formerPartnerById.get(id) ?? []) addEdge(id, former.otherId);
        for (const otherId of ids) {
          if (id >= otherId) continue;
          if (hasSharedChild(id, otherId)) addEdge(id, otherId);
        }
      }

      const used = new Set<string>();
      const units: RowUnit[] = [];
      let memberOrderCounter = 0;

      const collectComponent = (startId: string) => {
        const component: string[] = [];
        const stack = [startId];
        while (stack.length > 0) {
          const current = stack.pop();
          if (!current || used.has(current)) continue;
          used.add(current);
          component.push(current);
          for (const nextId of adjacency.get(current) ?? []) {
            if (!used.has(nextId)) stack.push(nextId);
          }
        }
        return component;
      };

      for (const id of ids) {
        if (used.has(id)) continue;
        const component = collectComponent(id);
        if (component.length === 0) continue;

        let orderedIds = [...component];
        let pivotId: string | null = null;

        if (component.length > 1) {
          pivotId = [...component].sort((leftId, rightId) => {
            const degreeLeft = adjacency.get(leftId)?.size ?? 0;
            const degreeRight = adjacency.get(rightId)?.size ?? 0;
            if (degreeLeft !== degreeRight) return degreeRight - degreeLeft;
            if (leftId === focusId) return -1;
            if (rightId === focusId) return 1;
            const childDiff = (filteredNodeMap.get(rightId)?.children.length ?? 0) - (filteredNodeMap.get(leftId)?.children.length ?? 0);
            if (childDiff !== 0) return childDiff;
            return (filteredNodeMap.get(leftId)?.member.full_name ?? "").localeCompare(filteredNodeMap.get(rightId)?.member.full_name ?? "", "vi");
          })[0] ?? null;

          const partnerIds = component.filter((memberId) => memberId !== pivotId);
          partnerIds.sort((leftId, rightId) => {
            const leftYear = getPairStartYear(pivotId!, leftId);
            const rightYear = getPairStartYear(pivotId!, rightId);
            if (leftYear !== rightYear) return leftYear - rightYear;
            return (filteredNodeMap.get(leftId)?.member.full_name ?? "").localeCompare(filteredNodeMap.get(rightId)?.member.full_name ?? "", "vi");
          });

          const oldestPartner = partnerIds[0] ? [partnerIds[0]] : [];
          const laterPartners = partnerIds.slice(1);
          orderedIds = [...laterPartners.reverse(), ...(pivotId ? [pivotId] : []), ...oldestPartner];

          partnerIds.forEach((partnerId, index) => {
            const partnerMember = filteredNodeMap.get(partnerId)?.member;
            const prefix = partnerMember?.gender === "MALE" ? "Chồng" : partnerMember?.gender === "FEMALE" ? "Vợ" : "Phối ngẫu";
            partnerSlotByMember.set(partnerId, `${prefix} ${index + 1}`);
          });
        } else {
          orderedIds = component;
        }


        const offsets = buildUnitOffsets(orderedIds, pivotId);
        const width = (offsets[offsets.length - 1] ?? 0) + CARD_WIDTH;
        units.push({ ids: orderedIds, depth, width, x: 0, pivotId, offsets });
        orderedIds.forEach((memberId) => {
          lastMemberOrderById.set(memberId, memberOrderCounter);
          memberOrderCounter += 1;
        });
      }

      rows.push({ depth, units });
    }

    const rowWidths = rows.map(
      (row) => row.units.reduce((sum, unit) => sum + unit.width, 0) + Math.max(row.units.length - 1, 0) * UNIT_GAP
    );
    const canvasWidth = Math.max(1320, ...rowWidths, CARD_WIDTH * 4) + 180;
    const positioned = new Map<string, PositionedMember>();

    rows.forEach((row, rowIndex) => {
      const rowWidth = rowWidths[rowIndex] ?? 0;
      let cursor = (canvasWidth - rowWidth) / 2;
      const y = 44 + row.depth * (NODE_HEIGHT + LEVEL_GAP);
      row.units.forEach((unit) => {
        unit.x = cursor;
        unit.ids.forEach((memberId, index) => {
          positioned.set(memberId, {
            id: memberId,
            depth: row.depth,
            x: cursor + (unit.offsets[index] ?? index * (CARD_WIDTH + COUPLE_GAP)),
            y,
          });
        });
        cursor += unit.width + UNIT_GAP;
      });
    });

    const canvasHeight = Math.max(DEFAULT_VIEWPORT_HEIGHT - 80, rows.length * (NODE_HEIGHT + LEVEL_GAP) + 160);
    const visibleMembers = [...filteredNodeMap.values()].map((node) => node.member);

    return { visibleMembers, rows, positioned, canvasWidth, canvasHeight, visibleSet, partnerSlotByMember };
  }, [
    allRootIds,
    childrenByParent,
    collapsedIds,
    focusId,
    formerPartnerById,
    maxDepth,
    nodeMap,
    parentsByChild,
    showFormerInPoster,
    scopeMode,
    spouseById,
    viewMode,
    relationshipMetaByPair,
    memberMap,
  ]);

  const focusMember = memberMap.get(focusId);
  const focusSummary = useMemo(
    () => computeFocusSummary(focusId, nodeMap, childrenByParent, parentsByChild, parentChild, partnerHistory),
    [focusId, nodeMap, childrenByParent, parentsByChild, parentChild, partnerHistory]
  );
  const focusAdoptedChildIds = useMemo(() => new Set(focusSummary.adoptedChildIds), [focusSummary.adoptedChildIds]);
  const focusFormerPartnerIds = useMemo(() => new Set(focusSummary.formerPartnerIds), [focusSummary.formerPartnerIds]);

  const fitToViewport = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport || visibleData.canvasWidth <= 0 || visibleData.canvasHeight <= 0) return;
    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    if (!width || !height) return;
    const nextZoom = clamp(
      Math.min((width - 48) / visibleData.canvasWidth, (height - 48) / visibleData.canvasHeight, 1),
      0.24,
      1
    );
    setZoom(nextZoom);
    setPan({
      x: (width - visibleData.canvasWidth * nextZoom) / 2,
      y: Math.max(24, (height - visibleData.canvasHeight * nextZoom) / 2),
    });
  }, [visibleData.canvasHeight, visibleData.canvasWidth]);

  useEffect(() => {
    fitToViewport();
  }, [fitToViewport]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      fitToViewport();
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [fitToViewport]);

  const jumpToMember = (memberId: string) => {
    setFocusId(memberId);
    setQuery("");
  };

  const stopInteractiveEvent = (event: React.SyntheticEvent) => {
    event.stopPropagation();
  };

  const openActionMenu = useCallback((memberId: string) => {
    setActionMenuId(memberId);
  }, []);

  const zoomAt = useCallback((clientX: number, clientY: number, nextZoom: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const pointerX = clientX - rect.left;
    const pointerY = clientY - rect.top;
    const clampedZoom = clamp(nextZoom, 0.22, 2.4);
    const worldX = (pointerX - pan.x) / zoom;
    const worldY = (pointerY - pan.y) / zoom;
    setZoom(clampedZoom);
    setPan({ x: pointerX - worldX * clampedZoom, y: pointerY - worldY * clampedZoom });
  }, [pan.x, pan.y, zoom]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const onWheel = (event: WheelEvent) => {
      const target = event.target;
      if (!(target instanceof Element) || !viewport.contains(target)) return;
      event.preventDefault();
      event.stopPropagation();
      const factor = event.deltaY < 0 ? 1.1 : 0.9;
      zoomAt(event.clientX, event.clientY, zoom * factor);
    };

    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      viewport.removeEventListener("wheel", onWheel);
    };
  }, [zoom, zoomAt]);

  const handlePointerDown: React.PointerEventHandler<HTMLDivElement> = (event) => {
    if (isInteractiveTarget(event.target)) return;
    dragStateRef.current = {
      active: true,
      startX: event.clientX,
      startY: event.clientY,
      originX: pan.x,
      originY: pan.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove: React.PointerEventHandler<HTMLDivElement> = (event) => {
    if (!dragStateRef.current.active) return;
    const dx = event.clientX - dragStateRef.current.startX;
    const dy = event.clientY - dragStateRef.current.startY;
    setPan({ x: dragStateRef.current.originX + dx, y: dragStateRef.current.originY + dy });
  };

  const handlePointerUp: React.PointerEventHandler<HTMLDivElement> = (event) => {
    dragStateRef.current.active = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const zoomAroundViewportCenter = (nextZoom: number) => {
    const viewport = viewportRef.current;
    if (!viewport) {
      setZoom(clamp(nextZoom, 0.22, 2.4));
      return;
    }
    const rect = viewport.getBoundingClientRect();
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, nextZoom);
  };

  const toggleCollapse = (memberId: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  };

  const visibleCount = visibleData.visibleMembers.length;
  const totalCount = members.length;

  if (!focusMember) return <div className="text-sm text-slate-600">Chưa có dữ liệu cây gia phả.</div>;

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm print:border-0 print:p-0 print:shadow-none">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between print:hidden">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Gia phả</div>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Cây gia phả dòng họ</h2>
            <p className="mt-1 max-w-4xl text-sm text-slate-600">
              Bản poster mới ưu tiên dễ đọc như sơ đồ gia đình: bớt dây nối chéo, gom theo cụm cha mẹ - con, vẫn có thể kéo nền để di chuyển, lăn chuột để zoom và thu gọn từng nhánh.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setFocusId(initialFocusId || members[0]?.id || "")}>Đặt lại trung tâm</Button>
            <Button variant="outline" className="rounded-xl" onClick={() => setCollapsedIds(new Set())}>Mở tất cả nhánh</Button>
            <Button variant="outline" className="rounded-xl" onClick={() => window.print()}>In cây gia phả</Button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 xl:grid-cols-[240px_1fr_140px_180px_160px] print:hidden">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Thành viên trung tâm</label>
            <select
              className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm shadow-sm outline-none transition focus:border-slate-900"
              value={focusId}
              onChange={(e) => setFocusId(e.target.value)}
            >
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.full_name}
                </option>
              ))}
            </select>
          </div>

          <div className="relative space-y-1">
            <label className="text-xs font-medium text-slate-600">Tìm nhanh thành viên</label>
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nhập tên để tìm nhanh" className="rounded-xl bg-white shadow-sm" />
            {suggestions.length > 0 ? (
              <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                {suggestions.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                    onClick={() => jumpToMember(m.id)}
                  >
                    {m.full_name}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Phạm vi xem</label>
            <select
              value={scopeMode}
              onChange={(e) => setScopeMode((e.target.value as ScopeMode) || "all")}
              className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm shadow-sm outline-none transition focus:border-slate-900"
            >
              <option value="all">Toàn bộ dòng họ</option>
              <option value="focused">Theo nhánh trung tâm</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Số đời hiển thị</label>
            <select
              value={String(maxDepth)}
              onChange={(e) => setMaxDepth(Number(e.target.value) || 99)}
              className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm shadow-sm outline-none transition focus:border-slate-900"
            >
              {[3, 5, 7, 99].map((depth) => (
                <option key={depth} value={depth}>
                  {depth === 99 ? "Tất cả đời" : `${depth} đời`}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm shadow-sm">
            <div className="text-slate-500">Đang xem</div>
            <div className="font-semibold text-slate-900">{visibleCount}/{totalCount} thành viên</div>
            <div className="mt-1 text-xs text-slate-500">Trung tâm: {focusMember.full_name}</div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 print:hidden">
          {([
            ["poster", "Poster"],
            ["families", "Theo hộ"],
            ["generations", "Theo đời"],
          ] as const).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={[
                "rounded-full border px-4 py-2 text-sm transition",
                viewMode === mode ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowFormerInPoster((prev) => !prev)}
            className={[
              "rounded-full border px-4 py-2 text-sm transition",
              showFormerInPoster ? "border-violet-200 bg-violet-50 text-violet-900" : "border-slate-300 bg-white text-slate-700",
            ].join(" ")}
          >
            {showFormerInPoster ? "Đang hiện phối ngẫu cũ dưới dạng thẻ" : "Đang ẩn phối ngẫu cũ trên poster"}
          </button>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">Nét liền: cha mẹ - con ruột</span>
          <span className="rounded-full border border-teal-200 bg-teal-50 px-3 py-2 text-xs text-teal-900">Nét chấm xanh: con nuôi</span>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">Nét đứt cam: con riêng trong gia đình ghép</span>
          <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-900">Phối ngẫu cũ được ghi bằng nhãn trong thẻ, không kéo dây chéo</span>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4 print:hidden">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm">
            <div className="text-slate-500">Cha / mẹ</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">{focusSummary.parentIds.length}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm">
            <div className="text-slate-500">Vợ / chồng hiện tại</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">{focusSummary.spouseIds.length}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm">
            <div className="text-slate-500">Con trực tiếp</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">{focusSummary.childIds.length}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm">
            <div className="text-slate-500">Con riêng bên phối ngẫu</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">{focusSummary.stepChildIds.length}</div>
          </div>
        </div>
      </div>

      {viewMode === "families" ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <div className="rounded-3xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff,#fafaf9)] p-6 shadow-sm">
              <div className="text-xs uppercase tracking-wide text-slate-500">Hạt nhân gia đình</div>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <HouseholdList title="Cha / Mẹ" ids={focusSummary.parentIds} nodeMap={nodeMap} focusId={focusId} onFocus={setFocusId} childrenByParent={childrenByParent} parentsByChild={parentsByChild} adoptedChildIds={focusAdoptedChildIds} formerPartnerIds={focusFormerPartnerIds} />
                <div className="rounded-2xl border border-slate-900 bg-slate-900 p-5 text-white shadow-lg">
                  <div className="text-xs uppercase tracking-wide text-slate-300">Trung tâm</div>
                  <div className="mt-2 text-2xl font-semibold">{focusMember.full_name}</div>
                  <div className="mt-1 text-sm text-slate-300">{formatLife(focusMember)}</div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl bg-white/10 p-3">
                      <div className="text-slate-300">Vợ/chồng</div>
                      <div className="mt-1 text-lg font-semibold">{focusSummary.spouseIds.length}</div>
                    </div>
                    <div className="rounded-xl bg-white/10 p-3">
                      <div className="text-slate-300">Con</div>
                      <div className="mt-1 text-lg font-semibold">{focusSummary.childIds.length}</div>
                    </div>
                  </div>
                </div>
                <HouseholdList title="Vợ / Chồng hiện tại" ids={focusSummary.spouseIds} nodeMap={nodeMap} focusId={focusId} onFocus={setFocusId} childrenByParent={childrenByParent} parentsByChild={parentsByChild} adoptedChildIds={focusAdoptedChildIds} formerPartnerIds={focusFormerPartnerIds} />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <HouseholdList title="Con" ids={focusSummary.childIds} nodeMap={nodeMap} focusId={focusId} onFocus={setFocusId} childrenByParent={childrenByParent} parentsByChild={parentsByChild} adoptedChildIds={focusAdoptedChildIds} formerPartnerIds={focusFormerPartnerIds} />
              <HouseholdList title="Con nuôi" ids={focusSummary.adoptedChildIds} nodeMap={nodeMap} focusId={focusId} onFocus={setFocusId} childrenByParent={childrenByParent} parentsByChild={parentsByChild} adoptedChildIds={focusAdoptedChildIds} formerPartnerIds={focusFormerPartnerIds} />
              <HouseholdList title="Con riêng bên vợ/chồng" ids={focusSummary.stepChildIds} nodeMap={nodeMap} focusId={focusId} onFocus={setFocusId} childrenByParent={childrenByParent} parentsByChild={parentsByChild} adoptedChildIds={focusAdoptedChildIds} formerPartnerIds={focusFormerPartnerIds} />
              <HouseholdList title="Phối ngẫu cũ" ids={focusSummary.formerPartnerIds} nodeMap={nodeMap} focusId={focusId} onFocus={setFocusId} childrenByParent={childrenByParent} parentsByChild={parentsByChild} adoptedChildIds={focusAdoptedChildIds} formerPartnerIds={focusFormerPartnerIds} />
              <HouseholdList title="Anh / Chị / Em" ids={focusSummary.siblingIds} nodeMap={nodeMap} focusId={focusId} onFocus={setFocusId} childrenByParent={childrenByParent} parentsByChild={parentsByChild} adoptedChildIds={focusAdoptedChildIds} formerPartnerIds={focusFormerPartnerIds} />
              <HouseholdList title="Cha dượng / Mẹ kế" ids={focusSummary.stepParentIds} nodeMap={nodeMap} focusId={focusId} onFocus={setFocusId} childrenByParent={childrenByParent} parentsByChild={parentsByChild} adoptedChildIds={focusAdoptedChildIds} formerPartnerIds={focusFormerPartnerIds} />
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="font-semibold text-slate-900">Tóm tắt nhánh</div>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">Vợ/chồng hiện tại: {focusSummary.spouseIds.length}</div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">Phối ngẫu cũ: {focusSummary.formerPartnerIds.length}</div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">Con trực tiếp: {focusSummary.childIds.length}</div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">Con nuôi: {focusSummary.adoptedChildIds.length}</div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">Con riêng bên vợ/chồng: {focusSummary.stepChildIds.length}</div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">Anh/chị/em: {focusSummary.siblingIds.length}</div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900">
                  Con riêng từ phía người phối ngẫu được giữ trong cùng cụm bằng nét đứt. Con nuôi vẫn là con trực tiếp nhưng được gắn nhãn riêng để không nhầm với con ruột.
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-xs text-slate-600">
              Chú giải: nét liền = quan hệ cha/mẹ-con trực tiếp; nét đứt màu cam = con riêng trong gia đình ghép; nét chấm màu xanh = con nuôi; nét tím đứt = phối ngẫu cũ. Mỗi thẻ còn cho biết số cha/mẹ, số con, số phối ngẫu hiện tại/cũ và trạng thái thu gọn nhánh.
            </div>
          </div>
        </div>
      ) : null}

      {viewMode === "generations" ? (
        <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          {visibleData.rows.map((row) => (
            <div key={row.depth} className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs uppercase tracking-wide text-slate-500">Đời {row.depth + 1}</div>
                <div className="text-xs text-slate-500">{row.units.reduce((sum, unit) => sum + unit.ids.length, 0)} thành viên</div>
              </div>
              <div className="grid gap-3 xl:grid-cols-4">
                {row.units.map((unit) => (
                  <div key={`${row.depth}-${unit.ids.join("-")}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap gap-2">
                      {unit.ids.map((id) => {
                        const node = nodeMap.get(id);
                        if (!node) return null;
                        const isCollapsed = collapsedIds.has(id);
                        return (
                          <div key={id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                            <button type="button" onClick={() => setFocusId(id)} className="text-left">
                              <div className="text-sm font-medium text-slate-900">{node.member.full_name}</div>
                              <div className="text-xs text-slate-500">{relationLabelForMember(id, focusId, nodeMap, childrenByParent, parentsByChild, focusAdoptedChildIds, focusFormerPartnerIds)}</div>
                            </button>
                            <div className="mt-2 text-xs text-slate-500">{formatLife(node.member)}</div>
                            {node.children.length > 0 ? (
                              <button type="button" onClick={() => toggleCollapse(id)} className="mt-3 text-xs text-slate-700 underline underline-offset-2">
                                {isCollapsed ? `Mở ${descendantCountById.get(id) ?? node.children.length} hậu duệ` : "Thu gọn nhánh con"}
                              </button>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                    {unit.ids.length === 2 ? <div className="mt-3 text-xs text-slate-500">Cụm vợ chồng / gia đình ghép</div> : null}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {viewMode === "poster" ? (
        <div className="space-y-3 rounded-3xl border border-slate-200 bg-[radial-gradient(circle_at_top_right,_rgba(244,114,182,0.08),_transparent_28%),radial-gradient(circle_at_bottom_left,_rgba(245,158,11,0.08),_transparent_26%),linear-gradient(180deg,#ffffff,#fafaf9)] p-4 shadow-inner">
          <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
            <div className="text-sm text-slate-600">
              Bố cục poster đã chuyển sang kiểu ít dây nối như mẫu gia phả minh họa: chỉ giữ các trục cha mẹ - con chính, còn quan hệ kế / cũ được ghi bằng nhãn trong thẻ để dễ đọc hơn.
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="rounded-xl" onClick={() => zoomAroundViewportCenter(zoom * 0.9)}>- Zoom</Button>
              <Button variant="outline" className="rounded-xl" onClick={() => zoomAroundViewportCenter(zoom * 1.1)}>+ Zoom</Button>
              <Button variant="outline" className="rounded-xl" onClick={fitToViewport}>Vừa khung</Button>
              <Button variant="outline" className="rounded-xl" onClick={() => zoomAroundViewportCenter(1)}>100%</Button>
            </div>
          </div>

          <div
            ref={viewportRef}
            className="relative overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/80 shadow-inner cursor-grab active:cursor-grabbing"
            style={{ minHeight: DEFAULT_VIEWPORT_HEIGHT, touchAction: "none", overscrollBehavior: "contain" }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <div
              style={{
                width: visibleData.canvasWidth,
                height: visibleData.canvasHeight,
                position: "absolute",
                left: 0,
                top: 0,
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: "top left",
              }}
              className="select-none"
            >
              <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${visibleData.canvasWidth} ${visibleData.canvasHeight}`} fill="none">
                {visibleData.rows.map((row) => {
                  const labelY = 18 + row.depth * (NODE_HEIGHT + LEVEL_GAP);
                  const guideY = labelY + 10;
                  return (
                    <g key={`band-${row.depth}`}>
                      <text x={22} y={labelY} fontSize="12" fill="#64748b" fontWeight="700">
                        Đời {row.depth + 1}
                      </text>
                      <line
                        x1={68}
                        y1={guideY}
                        x2={visibleData.canvasWidth - 24}
                        y2={guideY}
                        stroke="#dbe4ea"
                        strokeWidth="1.5"
                        strokeDasharray="5 7"
                      />
                    </g>
                  );
                })}

                {(() => {
                  const pairLineElements: ReactElement[] = [];
                  const renderedPairKeys = new Set<string>();
                  const registerPairLine = (leftId: string, rightId: string) => {
                    const left = visibleData.positioned.get(leftId);
                    const right = visibleData.positioned.get(rightId);
                    if (!left || !right) return;
                    if (left.depth !== right.depth) return;
                    const key = pairKey(leftId, rightId);
                    if (renderedPairKeys.has(key)) return;
                    renderedPairKeys.add(key);
                    const leftCenter = left.x + CARD_WIDTH / 2;
                    const rightCenter = right.x + CARD_WIDTH / 2;
                    const meta = relationshipMetaByPair.get(key);
                    const isCurrent = meta?.isCurrent || spouses.some((edge) => pairKey(edge.member_a_id, edge.member_b_id) === key);
                    const y = Math.min(left.y, right.y) + CARD_TOP + 16;
                    pairLineElements.push(
                      <line
                        key={`pair-${key}`}
                        x1={Math.min(leftCenter, rightCenter)}
                        y1={y}
                        x2={Math.max(leftCenter, rightCenter)}
                        y2={y}
                        stroke={isCurrent ? "#64748b" : "#94a3b8"}
                        strokeWidth="2"
                        strokeDasharray={isCurrent ? undefined : "6 5"}
                        strokeLinecap="round"
                      />
                    );
                  };

                  for (const edge of spouses) registerPairLine(edge.member_a_id, edge.member_b_id);
                  for (const item of partnerHistory) registerPairLine(item.member_a_id, item.member_b_id);
                  for (const [childId] of visibleData.positioned.entries()) {
                    const node = nodeMap.get(childId);
                    const parentIds = (node?.parents ?? []).filter((parentId) => visibleData.positioned.has(parentId));
                    if (parentIds.length === 2) {
                      const [leftParentId, rightParentId] = parentIds as [string, string];
                      registerPairLine(leftParentId, rightParentId);
                    }
                  }

                  const familyGroups = new Map<
                    string,
                    {
                      parentIds: string[];
                      parentPositions: PositionedMember[];
                      childInfos: Array<{ childId: string; childPos: PositionedMember; centerX: number; isAdoptedLink: boolean }>;
                    }
                  >();

                  for (const [childId, childPos] of visibleData.positioned.entries()) {
                    const node = nodeMap.get(childId);
                    if (!node) continue;
                    const parentIds = (node.parents ?? []).filter((parentId) => visibleData.positioned.has(parentId));
                    if (parentIds.length === 0) continue;

                    const sortedParentIds = [...parentIds].sort((a, b) => {
                      const posA = visibleData.positioned.get(a);
                      const posB = visibleData.positioned.get(b);
                      return (posA?.x ?? 0) - (posB?.x ?? 0);
                    });
                    const groupKey = `${childPos.depth}:${sortedParentIds.join("|")}`;
                    const parentPositions = sortedParentIds
                      .map((parentId) => visibleData.positioned.get(parentId))
                      .filter((value): value is PositionedMember => Boolean(value));
                    if (parentPositions.length === 0) continue;

                    const current = familyGroups.get(groupKey) ?? {
                      parentIds: sortedParentIds,
                      parentPositions,
                      childInfos: [],
                    };

                    current.childInfos.push({
                      childId,
                      childPos,
                      centerX: childPos.x + CARD_WIDTH / 2,
                      isAdoptedLink: parentChild.some(
                        (edge) => sortedParentIds.includes(edge.parent_id) && edge.child_id === childId && edge.child_link_type === "ADOPTED"
                      ),
                    });
                    familyGroups.set(groupKey, current);
                  }

                  const preparedGroups = [...familyGroups.entries()]
                    .map(([groupKey, group]) => {
                      const sortedParents = [...group.parentPositions].sort((a, b) => a.x - b.x);
                      const parentCenters = sortedParents.map((item) => item.x + CARD_WIDTH / 2);
                      const minParentX = Math.min(...parentCenters);
                      const maxParentX = Math.max(...parentCenters);
                      const familyAnchorX = parentCenters.reduce((sum, value) => sum + value, 0) / parentCenters.length;
                      const parentBottomY = Math.max(...sortedParents.map((item) => item.y + NODE_HEIGHT - 8));
                      const parentJoinY = parentBottomY + 14;
                      const childCenters = group.childInfos.map((item) => item.centerX);
                      const minChildX = Math.min(...childCenters);
                      const maxChildX = Math.max(...childCenters);
                      const sortedChildren = [...group.childInfos].sort((left, right) => {
                        const leftBirth = birthYear(memberMap.get(left.childId));
                        const rightBirth = birthYear(memberMap.get(right.childId));
                        if (leftBirth !== rightBirth) return leftBirth - rightBirth;
                        return right.centerX - left.centerX;
                      });

                      return {
                        groupKey,
                        group,
                        sortedParents,
                        sortedChildren,
                        parentCenters,
                        minParentX,
                        maxParentX,
                        familyAnchorX,
                        parentBottomY,
                        parentJoinY,
                        minChildX,
                        maxChildX,
                        parentDepth: sortedParents[0]?.depth ?? 0,
                        rangeStart: Math.min(minParentX, minChildX, familyAnchorX),
                        rangeEnd: Math.max(maxParentX, maxChildX, familyAnchorX),
                      };
                    })
                    .sort((left, right) => {
                      if (left.parentDepth !== right.parentDepth) return left.parentDepth - right.parentDepth;
                      if (left.rangeStart !== right.rangeStart) return left.rangeStart - right.rangeStart;
                      return left.rangeEnd - right.rangeEnd;
                    });

                  const laneSpacing = 22;
                  const laneEndByDepth = new Map<number, number[]>();
                  const childLineElements: ReactElement[] = [];

                  for (const prepared of preparedGroups) {
                    const lanes = laneEndByDepth.get(prepared.parentDepth) ?? [];
                    let laneIndex = 0;
                    while ((lanes[laneIndex] ?? -Infinity) > prepared.rangeStart - 24) laneIndex += 1;
                    lanes[laneIndex] = prepared.rangeEnd;
                    laneEndByDepth.set(prepared.parentDepth, lanes);

                    const childBusY = prepared.parentJoinY + 18 + laneIndex * laneSpacing;
                    const busStartX = Math.min(prepared.familyAnchorX, prepared.minChildX);
                    const busEndX = Math.max(prepared.familyAnchorX, prepared.maxChildX);

                    if (prepared.sortedParents.length === 1) {
                      childLineElements.push(
                        <line
                          key={`single-parent-${prepared.groupKey}`}
                          x1={prepared.familyAnchorX}
                          y1={prepared.parentBottomY}
                          x2={prepared.familyAnchorX}
                          y2={prepared.parentJoinY}
                          stroke="#7c8b9a"
                          strokeWidth="1.9"
                          strokeLinecap="round"
                        />
                      );
                    } else {
                      for (const parentCenter of prepared.parentCenters) {
                        childLineElements.push(
                          <line
                            key={`parent-drop-${prepared.groupKey}-${parentCenter}`}
                            x1={parentCenter}
                            y1={prepared.parentBottomY}
                            x2={parentCenter}
                            y2={prepared.parentJoinY}
                            stroke="#7c8b9a"
                            strokeWidth="1.9"
                            strokeLinecap="round"
                          />
                        );
                      }

                      childLineElements.push(
                        <line
                          key={`parent-bar-${prepared.groupKey}`}
                          x1={prepared.minParentX}
                          y1={prepared.parentJoinY}
                          x2={prepared.maxParentX}
                          y2={prepared.parentJoinY}
                          stroke="#7c8b9a"
                          strokeWidth="1.9"
                          strokeLinecap="round"
                        />
                      );
                    }

                    childLineElements.push(
                      <line
                        key={`family-stem-${prepared.groupKey}`}
                        x1={prepared.familyAnchorX}
                        y1={prepared.parentJoinY}
                        x2={prepared.familyAnchorX}
                        y2={childBusY}
                        stroke="#7c8b9a"
                        strokeWidth="1.9"
                        strokeLinecap="round"
                      />
                    );

                    if (prepared.sortedChildren.length === 1) {
                      const info = prepared.sortedChildren[0];
                      if (!info) continue;

                      if (Math.abs(info.centerX - prepared.familyAnchorX) > 1) {
                        childLineElements.push(
                          <line
                            key={`family-branch-${prepared.groupKey}`}
                            x1={Math.min(prepared.familyAnchorX, info.centerX)}
                            y1={childBusY}
                            x2={Math.max(prepared.familyAnchorX, info.centerX)}
                            y2={childBusY}
                            stroke="#7c8b9a"
                            strokeWidth="1.9"
                            strokeLinecap="round"
                          />
                        );
                      }

                      childLineElements.push(
                        <line
                          key={`drop-${prepared.groupKey}-${info.childId}`}
                          x1={info.centerX}
                          y1={childBusY}
                          x2={info.centerX}
                          y2={info.childPos.y + 6}
                          stroke={info.isAdoptedLink ? "#0f766e" : "#7c8b9a"}
                          strokeWidth="1.9"
                          strokeDasharray={info.isAdoptedLink ? "3 4" : undefined}
                          strokeLinecap="round"
                        />
                      );
                    } else {
                      childLineElements.push(
                        <line
                          key={`child-bus-${prepared.groupKey}`}
                          x1={busStartX}
                          y1={childBusY}
                          x2={busEndX}
                          y2={childBusY}
                          stroke="#7c8b9a"
                          strokeWidth="1.9"
                          strokeLinecap="round"
                        />
                      );

                      for (const info of prepared.sortedChildren) {
                        childLineElements.push(
                          <line
                            key={`drop-${prepared.groupKey}-${info.childId}`}
                            x1={info.centerX}
                            y1={childBusY}
                            x2={info.centerX}
                            y2={info.childPos.y + 6}
                            stroke={info.isAdoptedLink ? "#0f766e" : "#7c8b9a"}
                            strokeWidth="1.9"
                            strokeDasharray={info.isAdoptedLink ? "3 4" : undefined}
                            strokeLinecap="round"
                          />
                        );
                      }
                    }
                  }

                  return [...pairLineElements, ...childLineElements];
                })()}
              </svg>

              {[...visibleData.positioned.values()].map((pos) => {
                const node = nodeMap.get(pos.id);
                if (!node) return null;
                const member = node.member;
                const isFocus = member.id === focusId;
                const memberRoleLabel = relationLabelForMember(
                  member.id,
                  focusId,
                  nodeMap,
                  childrenByParent,
                  parentsByChild,
                  focusAdoptedChildIds,
                  focusFormerPartnerIds
                );
                const hasStepChildren = node.spouseIds.some((spouseId) =>
                  (childrenByParent.get(spouseId) ?? []).some((childId) => !node.children.includes(childId))
                );
                const isFormerPartner = focusFormerPartnerIds.has(member.id);
                const isAdoptedChild = focusAdoptedChildIds.has(member.id);
                const formerHistory = formerPartnerById.get(member.id) ?? [];
                const formerCount = formerHistory.length;
                const formerSummary = formerHistory.map((item) => partnerStatusLabel(item.status)).slice(0, 2).join(", ");
                const adoptedChildrenCount = adoptedChildrenByParent.get(member.id)?.size ?? 0;
                const partnerSlotLabel = visibleData.partnerSlotByMember.get(member.id) ?? null;
                const isDeceased = Boolean(member.dod);
                const isCollapsed = collapsedIds.has(member.id);
                const hiddenDescendants = isCollapsed ? descendantCountById.get(member.id) ?? 0 : 0;
                const isActionMenuOpen = actionMenuId === member.id;
                const statusBadges = [
                  isFocus ? "Trung tâm" : null,
                  isFormerPartner ? "Phối ngẫu cũ" : null,
                  isAdoptedChild ? "Con nuôi" : null,
                  hasStepChildren ? "Gia đình ghép" : null,
                  adoptedChildrenCount > 0 ? `${adoptedChildrenCount} con nuôi` : null,
                  hiddenDescendants > 0 ? `Ẩn ${hiddenDescendants} hậu duệ` : null,
                ].filter((value): value is string => Boolean(value));

                return (
                  <div
                    key={member.id}
                    data-no-drag="true"
                    onPointerDown={stopInteractiveEvent}
                    style={{ position: "absolute", left: pos.x, top: pos.y, width: CARD_WIDTH, height: NODE_HEIGHT }}
                    className="group pointer-events-auto"

                    onContextMenu={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      openActionMenu(member.id);
                    }}
                  >
                    <button
                      type="button"
                      data-no-drag="true"
                      onPointerDown={stopInteractiveEvent}
                      onClick={(event) => {
                        event.stopPropagation();
                        setFocusId(member.id);
                      }}
                      style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
                      className={[
                        "absolute left-1/2 top-0 z-10 flex -translate-x-1/2 items-center justify-center rounded-full border-[3px] text-sm font-semibold shadow-md transition",
                        isDeceased ? "border-slate-300 bg-slate-100 text-slate-700" : toneClass(member.gender),
                        isFocus ? "scale-105 border-slate-900 ring-2 ring-slate-200" : "border-white hover:-translate-y-0.5",
                      ].join(" ")}
                    >
                      {initials(member.full_name)}
                    </button>

                    <div
                      data-no-drag="true"
                      onPointerDown={stopInteractiveEvent}
                      onClick={(event) => {
                        if (isInteractiveTarget(event.target)) return;
                        event.stopPropagation();
                        setActionMenuId((current) => (current === member.id ? null : member.id));
                      }}
                      className="absolute inset-x-0 bottom-0 rounded-[22px] border border-slate-200 bg-white/98 px-3 pb-3 pt-8 text-center shadow-md backdrop-blur"
                      style={{ top: CARD_TOP, minHeight: NODE_HEIGHT - CARD_TOP }}
                    >
                      <div className="flex min-h-[18px] items-center justify-center gap-1 text-[10px] font-medium">
                        {partnerSlotLabel ? <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-600">{partnerSlotLabel}</span> : null}
                        {isDeceased ? <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-slate-600">🪷 Đã mất</span> : null}
                      </div>
                      <div className="mt-1 min-h-[32px] text-[13px] font-semibold leading-4 text-slate-900">{member.full_name}</div>
                      <div className="mt-1 inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600">
                        {memberRoleLabel}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500">{formatLife(member)}</div>
                      <div className="mt-2 text-[10px] text-slate-500">{node.parents.length} cha/mẹ · {node.children.length} con · {node.spouseIds.length} hiện tại{formerCount > 0 ? ` · ${formerCount} cũ` : ""}</div>
                      <div className="mt-2 min-h-[30px] flex flex-wrap items-start justify-center gap-1">
                        {statusBadges.length > 0 ? (
                          statusBadges.slice(0, 3).map((badge) => (
                            <span key={badge} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-medium text-slate-600">
                              {badge}
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] text-slate-400">Không có nhãn đặc biệt</span>
                        )}
                      </div>
                      {formerSummary ? (
                        <div className="mt-1 text-[9px] font-medium text-violet-700">Quan hệ cũ: {formerSummary}</div>
                      ) : null}
                      <div className="mt-2 min-h-[18px] text-[9px] text-slate-400">
                        {isActionMenuOpen ? "Đang mở thao tác" : null}
                      </div>
                      {isActionMenuOpen ? (
                        <div
                          data-no-drag="true"
                          data-action-menu="true"
                          onPointerDown={stopInteractiveEvent}
                          className="absolute left-1/2 top-full z-20 mt-2 flex -translate-x-1/2 flex-wrap items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white/98 px-3 py-2 text-[10px] font-medium text-slate-700 shadow-lg backdrop-blur"
                        >
                          <button
                            type="button"
                            data-no-drag="true"
                            className="rounded-full border border-slate-200 bg-white px-2.5 py-1 hover:bg-slate-50"
                            onPointerDown={stopInteractiveEvent}
                            onClick={(event) => {
                              event.stopPropagation();
                              setFocusId(member.id);
                              setActionMenuId(null);
                            }}
                          >
                            Trung tâm
                          </button>
                          {node.children.length > 0 ? (
                            <button
                              type="button"
                              data-no-drag="true"
                              className="rounded-full border border-slate-200 bg-white px-2.5 py-1 hover:bg-slate-50"
                              onPointerDown={stopInteractiveEvent}
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleCollapse(member.id);
                                setActionMenuId(null);
                              }}
                            >
                              {isCollapsed ? "Mở nhánh" : "Thu gọn"}
                            </button>
                          ) : null}
                          <Link
                            href={`/members/${member.id}`}
                            data-no-drag="true"
                            className="rounded-full border border-slate-200 bg-white px-2.5 py-1 hover:bg-slate-50"
                            onPointerDown={stopInteractiveEvent}
                            onClick={(event) => {
                              event.stopPropagation();
                              setActionMenuId(null);
                            }}
                          >
                            Chi tiết
                          </Link>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
