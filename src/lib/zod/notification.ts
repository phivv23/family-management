import { z } from "zod";

export const createNotificationSchema = z.object({
  title: z.string().min(2).max(200),
  body: z.string().max(4000).optional().nullable(),
  kind: z.string().min(2).max(50).default("ANNOUNCEMENT"),
  eventId: z.string().uuid().optional().nullable(),
  scheduledFor: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  isPinned: z.boolean().optional().default(false),
});
