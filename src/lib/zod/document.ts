import { z } from "zod";

export const documentTypeEnum = z.enum(["PDF", "IMAGE", "OTHER"]);

export const createDocumentSchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().max(2000).optional().nullable(),
  docType: documentTypeEnum.default("OTHER"),
  tags: z.array(z.string().min(1).max(40)).optional().default([]),
  memberId: z.string().uuid().optional().nullable(),
  eventId: z.string().uuid().optional().nullable(),
  visibility: z.enum(["CLAN", "PUBLIC", "MANAGER_ONLY"]).default("CLAN")
});

export const attachDocumentFileSchema = z.object({
  documentId: z.string().uuid(),
  bucket: z.string().min(1),
  objectPath: z.string().min(1),
  fileName: z.string().min(1).max(260),
  mimeType: z.string().max(120).optional().nullable(),
  sizeBytes: z.number().int().nonnegative().max(1024 * 1024 * 200).optional().nullable()
});
