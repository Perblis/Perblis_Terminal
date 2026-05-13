"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { authApi } from "@/lib/api/auth";
import { ApiError, setTokens } from "@/lib/api/client";
import { usersApi } from "@/lib/api/users";

const schema = z
  .object({
    first_name: z.string().min(1, "Required."),
    last_name: z.string().min(1, "Required."),
    email: z.string().email("Enter a valid email."),
    phone: z.string().min(10, "Use a valid phone number."),
    password: z.string().min(8, "Minimum 8 characters."),
    password_confirm: z.string(),
  })
  .refine((v) => v.password === v.password_confirm, {
    message: "Passwords don't match.",
    path: ["password_confirm"],
  });

type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();

  const register = useMutation({
    mutationFn: async (v: FormValues) => {
      const res = await authApi.register(v);
      const tokens = res.tokens;
      if (tokens?.access && tokens?.refresh) {
        setTokens(tokens.access, tokens.refresh);
      }
      // Flip the new account to the owner role so the cookie-side login
      // below passes the is_owner gate. Registration defaults to renter.
      await usersApi.updateRole(true, true).catch(() => undefined);

      // Mirror the session into the httpOnly cookie via the login route
      // so middleware sees the user as authenticated.
      const cookieRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: v.email, password: v.password }),
      });
      if (!cookieRes.ok) {
        const body = await cookieRes.json().catch(() => ({}));
        throw new Error(
          body?.error?.detail ?? "Account created, but signing you in failed. Please log in.",
        );
      }
      return res;
    },
    onSuccess: () => router.replace("/verify-phone"),
  });

  const {
    register: rhf,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const errorMessage = (() => {
    if (!register.error) return null;
    if (register.error instanceof ApiError) {
      const body = register.error.body as
        | { errors?: Record<string, string[] | string> }
        | undefined;
      if (body?.errors && typeof body.errors === "object") {
        const first = Object.values(body.errors)[0];
        if (Array.isArray(first) && first[0]) return first[0];
        if (typeof first === "string") return first;
      }
      return register.error.message || "Registration failed.";
    }
    return (register.error as Error).message;
  })();

  return (
    <div className="space-y-8">
      <div>
        <div className="font-display text-[36px] leading-none tracking-tight uppercase">
          Create owner account
        </div>
        <p className="text-text-secondary mt-2">You will verify your phone right after.</p>
      </div>

      <form onSubmit={handleSubmit((v) => register.mutate(v))} className="space-y-5" noValidate>
        <div className="grid grid-cols-2 gap-4">
          <Field id="first_name" label="First name" error={errors.first_name?.message}>
            <Input
              id="first_name"
              autoComplete="given-name"
              invalid={!!errors.first_name}
              {...rhf("first_name")}
            />
          </Field>
          <Field id="last_name" label="Last name" error={errors.last_name?.message}>
            <Input
              id="last_name"
              autoComplete="family-name"
              invalid={!!errors.last_name}
              {...rhf("last_name")}
            />
          </Field>
        </div>

        <Field id="email" label="Email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            invalid={!!errors.email}
            {...rhf("email")}
          />
        </Field>

        <Field
          id="phone"
          label="Phone"
          hint="Used for OTP verification."
          error={errors.phone?.message}
        >
          <Input
            id="phone"
            type="tel"
            autoComplete="tel"
            placeholder="+234…"
            invalid={!!errors.phone}
            {...rhf("phone")}
          />
        </Field>

        <Field id="password" label="Password" error={errors.password?.message}>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            invalid={!!errors.password}
            {...rhf("password")}
          />
        </Field>

        <Field
          id="password_confirm"
          label="Confirm password"
          error={errors.password_confirm?.message}
        >
          <Input
            id="password_confirm"
            type="password"
            autoComplete="new-password"
            invalid={!!errors.password_confirm}
            {...rhf("password_confirm")}
          />
        </Field>

        {errorMessage ? <p className="text-alert-soft text-[13px]">{errorMessage}</p> : null}

        <Button type="submit" fullWidth size="lg" disabled={register.isPending}>
          {register.isPending ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="text-text-secondary text-center text-[13px]">
        Already have an account?{" "}
        <Link href="/login" className="text-forge">
          Sign in
        </Link>
      </p>
    </div>
  );
}
