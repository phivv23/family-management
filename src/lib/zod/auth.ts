import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Email không hợp lệ."),
  password: z.string().min(6, "Mật khẩu phải có ít nhất 6 ký tự."),
});

export const registerAccountSchema = z
  .object({
    email: z.string().email("Email không hợp lệ."),
    password: z
      .string()
      .min(8, "Mật khẩu phải có ít nhất 8 ký tự.")
      .max(72, "Mật khẩu không quá 72 ký tự."),
    confirmPassword: z.string().min(8, "Hãy nhập lại mật khẩu."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Mật khẩu nhập lại chưa khớp.",
    path: ["confirmPassword"],
  });

export const registerProfileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Họ tên phải có ít nhất 2 ký tự.")
    .max(120, "Họ tên không quá 120 ký tự."),
  gender: z.enum(["MALE", "FEMALE", "OTHER", "UNKNOWN"]).default("UNKNOWN"),
  dob: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày sinh không hợp lệ.")
    .optional()
    .or(z.literal(""))
    .transform((v) => v || ""),
  phone: z
    .string()
    .trim()
    .max(30, "Số điện thoại không quá 30 ký tự.")
    .optional()
    .default(""),
  hometown: z
    .string()
    .trim()
    .max(160, "Quê quán không quá 160 ký tự.")
    .optional()
    .default(""),
  address: z
    .string()
    .trim()
    .max(240, "Địa chỉ không quá 240 ký tự.")
    .optional()
    .default(""),
  bio: z
    .string()
    .trim()
    .max(2000, "Ghi chú không quá 2000 ký tự.")
    .optional()
    .default(""),
});

export const onboardingSchema = z.object({ clanName: z.string().min(2).max(120) });
