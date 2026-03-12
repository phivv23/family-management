import { z } from "zod";

export const eventTypeEnum = z.enum(["DEATH_ANNIVERSARY", "MEETING", "BIRTHDAY", "OTHER"]);

export const createEventSchema = z.object({
  title: z.string().min(2).max(200),
  type: eventTypeEnum.default("OTHER"),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  memberId: z.string().uuid().optional().nullable(),
  note: z.string().max(2000).optional().nullable()
});

export const updateEventSchema = createEventSchema.extend({
  id: z.string().uuid()
});
