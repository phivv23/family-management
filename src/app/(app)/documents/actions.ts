"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuth, requireRole } from "@/lib/auth/context";
import { attachDocumentFileSchema, createDocumentSchema } from "@/lib/zod/document";

export async function createDocumentAction(payload: unknown) {
  const parsed = createDocumentSchema.safeParse(payload);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };

  const ctx = await requireAuth();
  requireRole(ctx, ["admin", "clan_manager"]);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_document", {
    p_title: parsed.data.title,
    p_description: parsed.data.description ?? null,
    p_doc_type: parsed.data.docType,
    p_tags: parsed.data.tags ?? [],
    p_member_id: parsed.data.memberId ?? null,
    p_event_id: parsed.data.eventId ?? null,
    p_visibility: parsed.data.visibility,
  });

  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/documents");
  return { ok: true as const, id: String(data) };
}

export async function attachDocumentFileAction(payload: unknown) {
  const parsed = attachDocumentFileSchema.safeParse(payload);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };

  const ctx = await requireAuth();
  requireRole(ctx, ["admin", "clan_manager"]);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("attach_to_document", {
    p_document_id: parsed.data.documentId,
    p_bucket: parsed.data.bucket,
    p_object_path: parsed.data.objectPath,
    p_file_name: parsed.data.fileName,
    p_mime_type: parsed.data.mimeType ?? null,
    p_size_bytes: parsed.data.sizeBytes ?? 0,
  });

  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/documents");
  revalidatePath(`/documents/${parsed.data.documentId}`);
  return { ok: true as const };
}

export async function deleteDocumentAction(documentId: string) {
  const ctx = await requireAuth();
  requireRole(ctx, ["admin", "clan_manager"]);
  const supabase = await createSupabaseServerClient();

  const { data: attachmentRows } = await supabase
    .from("document_attachments")
    .select("attachments(bucket,object_path)")
    .eq("clan_id", ctx.activeClanId)
    .eq("document_id", documentId);

  const objectsToDelete = (attachmentRows ?? [])
    .map((row) => row.attachments)
    .flat()
    .filter((item): item is { bucket: string; object_path: string } => Boolean(item?.bucket && item?.object_path));

  const { error } = await supabase.rpc("delete_document", { p_document_id: documentId });
  if (error) return { ok: false as const, error: error.message };

  const grouped = new Map<string, string[]>();
  for (const item of objectsToDelete) {
    grouped.set(item.bucket, [...(grouped.get(item.bucket) ?? []), item.object_path]);
  }

  for (const [bucket, paths] of grouped.entries()) {
    if (paths.length === 0) continue;
    const { error: storageError } = await supabase.storage.from(bucket).remove(paths);
    if (storageError) {
      return { ok: false as const, error: `Document deleted but file cleanup failed: ${storageError.message}` };
    }
  }

  revalidatePath("/documents");
  revalidatePath(`/documents/${documentId}`);
  return { ok: true as const };
}
