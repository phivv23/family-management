import { z } from "zod";
import { genderEnum } from "@/lib/zod/member";

export const roleEnum = z.enum(["admin", "clan_manager", "treasurer", "approver", "member"]);
export const accountProfileModeEnum = z.enum(["none", "existing", "create"]);

export const newMemberProfileSchema = z.object({
  fullName: z.string().trim().min(2, "Họ tên phải có ít nhất 2 ký tự.").max(120, "Họ tên không quá 120 ký tự."),
  gender: genderEnum.default("UNKNOWN"),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày sinh không hợp lệ.").optional().nullable(),
  bio: z.string().max(2000, "Ghi chú không quá 2000 ký tự.").optional().nullable(),
});

function validateLinking<T extends { linkMode?: "none" | "existing" | "create"; memberId?: string | null; newMember?: unknown }>(payload: T, ctx: z.RefinementCtx) {
  if (payload.linkMode === "existing" && !payload.memberId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Hãy chọn hồ sơ thành viên có sẵn." });
  }
  if (payload.linkMode === "create") {
    const parsed = newMemberProfileSchema.safeParse(payload.newMember);
    if (!parsed.success) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: parsed.error.issues[0]?.message ?? "Thông tin hồ sơ mới không hợp lệ." });
    }
  }
}

export const addMemberByEmailSchema = z.object({
  email: z.string().email("Email không hợp lệ."),
  role: roleEnum.default("member"),
  linkMode: accountProfileModeEnum.default("none"),
  memberId: z.string().uuid().nullable().optional(),
  newMember: newMemberProfileSchema.optional().nullable(),
}).superRefine(validateLinking);

export const createInvitationSchema = z.object({
  email: z.string().email("Email không hợp lệ."),
  role: roleEnum.default("member"),
  linkMode: accountProfileModeEnum.default("none"),
  memberId: z.string().uuid().nullable().optional(),
  newMember: newMemberProfileSchema.optional().nullable(),
  note: z.string().max(300, "Ghi chú không quá 300 ký tự.").optional().nullable(),
  expireDays: z.coerce.number().int().min(1).max(60).default(14),
}).superRefine(validateLinking);

export const cancelInvitationSchema = z.object({
  invitationId: z.string().uuid(),
});

export const setRoleSchema = z.object({
  userId: z.string().uuid(),
  role: roleEnum,
});

export const linkMemberSchema = z.object({
  userId: z.string().uuid(),
  memberId: z.string().uuid().nullable(),
});
