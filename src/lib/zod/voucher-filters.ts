import { z } from "zod";

export const voucherStatusEnum = z.enum(["DRAFT", "PENDING", "APPROVED", "REJECTED"]);
export const voucherTypeEnum = z.enum(["INCOME", "EXPENSE"]);

export const voucherListQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  fundId: z.string().uuid().optional(),
  status: voucherStatusEnum.optional(),
  type: voucherTypeEnum.optional(),
});
