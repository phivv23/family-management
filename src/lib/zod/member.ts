import { z } from "zod";

export const genderEnum = z.enum(["MALE", "FEMALE", "OTHER", "UNKNOWN"]);
export const parentRoleEnum = z.enum(["FATHER", "MOTHER"]);
export const childLinkTypeEnum = z.enum(["BIOLOGICAL", "ADOPTED"]);
export const partnerRelationshipKindEnum = z.enum(["MARRIAGE", "PARTNERSHIP"]);
export const partnerCloseStatusEnum = z.enum(["DIVORCED", "SEPARATED", "WIDOWED"]);

export const createMemberSchema = z.object({
  fullName: z.string().min(2).max(120),
  gender: genderEnum.default("UNKNOWN"),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  dod: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  bio: z.string().max(2000).optional().nullable()
});

export const updateMemberSchema = createMemberSchema.extend({
  id: z.string().uuid()
});

export const addParentChildSchema = z.object({
  parentId: z.string().uuid(),
  childId: z.string().uuid(),
  parentRole: parentRoleEnum,
  childLinkType: childLinkTypeEnum.optional().default("BIOLOGICAL")
});

export const linkParentChildSchema = z.object({
  parentId: z.string().uuid(),
  childId: z.string().uuid()
});

export const linkSpouseSchema = z.object({
  memberId: z.string().uuid(),
  spouseId: z.string().uuid()
});

export const addPartnerRelationshipSchema = z.object({
  memberId: z.string().uuid(),
  partnerId: z.string().uuid(),
  startedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  note: z.string().max(1000).optional().nullable(),
  relationshipKind: partnerRelationshipKindEnum.optional().default("MARRIAGE")
});

export const closePartnerRelationshipSchema = z.object({
  memberId: z.string().uuid(),
  partnerId: z.string().uuid(),
  closeStatus: partnerCloseStatusEnum,
  endedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  note: z.string().max(1000).optional().nullable()
});
