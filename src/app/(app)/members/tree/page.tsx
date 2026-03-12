import { requireAuth } from "@/lib/auth/context";
import { createSupabaseServerComponentClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { TreeLevelView } from "@/components/genealogy/TreeLevelView";

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

export default async function MembersTreePage({ searchParams }: { searchParams: Promise<{ root?: string; highlight?: string }> }) {
  const ctx = await requireAuth();
  const sp = await searchParams;
  const initialRootId = sp.root && isUuid(sp.root) ? sp.root : null;
  const initialSelectedId = sp.highlight && isUuid(sp.highlight) ? sp.highlight : null;

  const supabase = await createSupabaseServerComponentClient();

  type MemberRow = { id: string; full_name: string; gender: string; dob: string | null; dod: string | null };
  type ParentChildRow = { parent_id: string; child_id: string; child_link_type: "BIOLOGICAL" | "ADOPTED" | null };
  type SpouseRow = { member_a_id: string; member_b_id: string };
  type PartnerHistoryRow = {
    id: string;
    member_a_id: string;
    member_b_id: string;
    relationship_status: "CURRENT" | "DIVORCED" | "SEPARATED" | "WIDOWED";
    started_on: string | null;
    ended_on: string | null;
    note: string | null;
  };

  const [{ data: members }, { data: parentChild }, { data: spouses }, { data: partnerHistory }] = await Promise.all([
    supabase
      .from("members")
      .select("id,full_name,gender,dob,dod")
      .eq("clan_id", ctx.activeClanId)
      .order("full_name", { ascending: true })
      .limit(5000)
      .returns<MemberRow[]>(),
    supabase
      .from("member_parent_child")
      .select("parent_id,child_id,child_link_type")
      .eq("clan_id", ctx.activeClanId)
      .limit(20000)
      .returns<ParentChildRow[]>(),
    supabase
      .from("member_spouses")
      .select("member_a_id,member_b_id")
      .eq("clan_id", ctx.activeClanId)
      .limit(20000)
      .returns<SpouseRow[]>(),
    supabase
      .from("member_partner_relationships")
      .select("id,member_a_id,member_b_id,relationship_status,started_on,ended_on,note")
      .eq("clan_id", ctx.activeClanId)
      .limit(20000)
      .returns<PartnerHistoryRow[]>(),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader title="Cây gia phả" subtitle="Xem theo poster, theo hộ hoặc theo các đời; làm rõ con riêng, con nuôi, phối ngẫu cũ và tái hôn" />
      <Card>
        <CardContent className="p-4">
          <TreeLevelView
            members={members ?? []}
            parentChild={parentChild ?? []}
            spouses={spouses ?? []}
            partnerHistory={partnerHistory ?? []}
            initialRootId={initialRootId}
            initialSelectedId={initialSelectedId}
          />
        </CardContent>
      </Card>
    </div>
  );
}
