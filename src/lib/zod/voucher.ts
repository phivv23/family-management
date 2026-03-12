import { z } from "zod";
export const voucherTypeEnum = z.enum(["INCOME","EXPENSE"]);
export const createVoucherSchema = z.object({
  fundId: z.string().uuid(),
  categoryId: z.string().uuid().optional().nullable(),
  voucherType: voucherTypeEnum,
  title: z.string().min(2).max(160),
  description: z.string().max(1000).optional().nullable(),
  amount: z.coerce.number().positive().max(999999999999),
  voucherDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  memberId: z.string().uuid().optional().nullable(),
  householdLabel: z.string().max(160).optional().nullable()
});
export const updateVoucherSchema = createVoucherSchema.extend({ id: z.string().uuid() });
export const rejectVoucherSchema = z.object({ id: z.string().uuid(), reason: z.string().min(3).max(500) });
export const attachToVoucherSchema = z.object({
  voucherId: z.string().uuid(),
  bucket: z.literal("clan-files"),
  objectPath: z.string().min(3).max(512),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().max(255).optional().nullable(),
  sizeBytes: z.coerce.number().int().nonnegative().max(2_000_000_000),
  checksum: z.string().max(255).optional().nullable()
});
