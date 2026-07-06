// Copied from portal/lib/auth-schemas.ts (Wave 7) — keep in sync by copy, not import;
// the portal stays untouched by app changes (design.md §7 wave isolation).
// zod schemas mirroring DRF validation (TSD §5) — accounts/serializers.py is
// the source of truth; keep messages in the 09 §1 voice (name the fix).
import { z } from "zod";

/** Mirrors backend normalize_ng_phone: 0803… / 234… / +234… → +234803…. */
export function normalizeNgPhone(raw: string): string {
  const digits = raw.replace(/[\s().-]/g, "");
  if (/^\+234\d{10}$/.test(digits)) return digits;
  if (/^234\d{10}$/.test(digits)) return `+${digits}`;
  if (/^0\d{10}$/.test(digits)) return `+234${digits.slice(1)}`;
  return digits;
}

export const phoneSchema = z
  .string()
  .transform(normalizeNgPhone)
  .refine((v) => /^\+234\d{10}$/.test(v), {
    message: "Enter an 11-digit phone number, e.g. 0803 123 4567.",
  });

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters and include an uppercase letter and a number.")
  .refine((v) => /[A-Z]/.test(v) && /\d/.test(v), {
    message: "Password must be at least 8 characters and include an uppercase letter and a number.",
  });

export const registerSchema = z.object({
  full_name: z.string().trim().min(1, "Enter your full name.").max(150),
  email: z.string().email("Enter a valid email address."),
  phone: phoneSchema,
  password: passwordSchema,
  accept_tos: z.literal(true, {
    errorMap: () => ({ message: "You must accept the Terms of Service and Privacy Policy." }),
  }),
  accept_privacy: z.literal(true, {
    errorMap: () => ({ message: "You must accept the Terms of Service and Privacy Policy." }),
  }),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export type LoginInput = z.infer<typeof loginSchema>;
