import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export type TreeNode = {
  id: string;
  full_name: string;
  gender: string;
  dob: string | null;
  dod: string | null;
  children: TreeNode[];
};

function NodeCard({ node, depth }: { node: TreeNode; depth: number }) {
  return (
    <div className="space-y-2" style={{ marginLeft: depth * 16 }}>
      <Card>
        <CardHeader className="p-3 border-b border-slate-100">
          <div className="flex items-center justify-between gap-2">
            <Link className="underline text-sm" href={`/members/${node.id}`}>{node.full_name}</Link>
            <Badge variant="outline">{node.gender}</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-3 text-xs text-slate-600">
          {node.dob ? `DOB: ${node.dob}` : "DOB: -"} · {node.dod ? `DOD: ${node.dod}` : "DOD: -"}
        </CardContent>
      </Card>
      {node.children.length > 0 ? (
        <div className="space-y-2">
          {node.children.map((c) => <NodeCard key={c.id} node={c} depth={depth + 1} />)}
        </div>
      ) : null}
    </div>
  );
}

export function TreeView({ roots }: { roots: TreeNode[] }) {
  if (roots.length === 0) return <p className="text-sm text-slate-600">Chưa có thành viên nào.</p>;
  return (
    <div className="space-y-3">
      {roots.map((r) => <NodeCard key={r.id} node={r} depth={0} />)}
    </div>
  );
}
