"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { useLogin } from "@/hooks/useAuth";

const schema = z.object({
  email: z.string().email("Enter a valid email."),
  password: z.string().min(1, "Password is required."),
});

type FormValues = z.infer<typeof schema>;

function LoginForm() {
  const sp = useSearchParams();
  const next = sp.get("next") ?? "/dashboard";
  const errorBanner = sp.get("error");
  const login = useLogin();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = (v: FormValues) =>
    login.mutateAsync({ email: v.email, password: v.password, next });

  const ownerRequired = errorBanner === "owner_required";

  return (
    <div className="space-y-8">
      <div>
        <div className="font-display text-[36px] leading-none tracking-tight uppercase">
          Terminal
        </div>
        <p className="text-text-secondary mt-2">Owner sign-in.</p>
      </div>

      {ownerRequired ? (
        <div className="border-border-active bg-amber-dim text-text-primary border-l-amber rounded border-l-[3px] px-4 py-3 text-[13px]">
          That account is not enabled as an owner. Switch on the owner role from your profile, then
          sign in again.
        </div>
      ) : null}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <Field id="email" label="Email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            invalid={!!errors.email}
            {...register("email")}
          />
        </Field>

        <Field id="password" label="Password" error={errors.password?.message}>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            invalid={!!errors.password}
            {...register("password")}
          />
        </Field>

        {login.error ? (
          <p className="text-alert-soft text-[13px]">{(login.error as Error).message}</p>
        ) : null}

        <Button type="submit" fullWidth size="lg" disabled={isSubmitting}>
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <div className="flex items-center justify-between text-[13px]">
        <Link href="/forgot-password" className="text-text-secondary hover:text-text-primary">
          Forgot password?
        </Link>
        <Link href="/register" className="text-forge">
          Create an account
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  // useSearchParams requires a Suspense boundary in App Router.
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
