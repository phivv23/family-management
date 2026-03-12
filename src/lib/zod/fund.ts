import { z } from "zod";

export const createFundSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(500).optional().nullable(),
  currency: z.string().min(3).max(8).default("VND")
});

export const updateFundSchema = createFundSchema.extend({
  id: z.string().uuid()
});
