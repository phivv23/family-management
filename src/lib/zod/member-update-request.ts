import { z } from "zod";
import { genderEnum } from "@/lib/zod/member";

export const createMemberUpdateRequestSchema = z.object({
  memberId: z.string().uuid(),
  fullName: z.string().min(2).max(120),
  gender: genderEnum.default("UNKNOWN"),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  dod: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  bio: z.string().max(2000).optional().nullable(),
  note: z.string().max(1000).optional().nullable(),
});

export const reviewMemberUpdateRequestSchema = z.object({
  requestId: z.string().uuid(),
  decision: z.enum(["APPROVED", "REJECTED"]),
  reviewNote: z.string().max(1000).optional().nullable(),
});
