import { requireAuth, requireRole } from "@/lib/auth/context";
import { DocumentUploadForm } from "./DocumentUploadForm";

export default async function UploadDocumentPage() {
  const ctx = await requireAuth();
  requireRole(ctx, ["admin", "clan_manager"]);
  return <DocumentUploadForm clanId={ctx.activeClanId} />;
}
