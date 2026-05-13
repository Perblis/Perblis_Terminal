# TERMINAL OWNER WEB — WAVE 01: AUTH

> Agent task file. Execute every instruction in order. Do not skip steps.
> Do not proceed to Wave 02 until the Definition of Done checklist is fully complete.

---

## Context

Wave 00 set up the Next.js skeleton, TDS tokens, the typed API client with JWT refresh, and an empty login page. This wave delivers the **full owner authentication flow**:

- Login (email + password)
- Register (email, phone, names, password) — owner role enforced
- Phone OTP verification (post-register and standalone)
- Resend OTP
- Forgot / reset password (email + OTP)
- Change password (post-login, in settings — stub here, page added in Wave 06)
- Logout
- httpOnly cookie session (server-side) so middleware can guard `/dashboard`, `/listings`, etc.
- Auth-aware route layout that redirects unauthenticated users

**Backend endpoints used** (all under `{API_BASE_URL}/api/v1/auth/` and `/api/v1/users/`):

| Endpoint | Method | Request body | Response |
|---|---|---|---|
| `/auth/register/` | POST | `{email, phone, first_name, last_name, password, password_confirm}` | `{id, email, created_at}` + tokens (in `data`) |
| `/auth/login/` | POST | `{email, password}` | `{access, refresh, user: {...}}` |
| `/auth/token/refresh/` | POST | `{refresh}` | `{access}` |
| `/auth/logout/` | POST | — | `{success: true}` |
| `/auth/verify-phone/` | POST | `{otp_code}` | `{success: true}` |
| `/auth/resend-otp/` | POST | — | `{success: true}` |
| `/auth/password/change/` | POST | `{old_password, new_password, new_password_confirm}` | `{success: true}` |
| `/auth/password/reset/` | POST | `{email}` | OTP sent via SMS |
| `/auth/password/reset/confirm/` | POST | `{email, otp_code, new_password}` | `{success: true}` |
| `/users/me/` | GET | — | `{success: true, data: {id, email, phone, first_name, last_name, full_name, profile_photo, bio, is_renter, is_owner, verification_level, is_phone_verified, is_email_verified, is_id_verified, created_at}}` |
| `/users/me/role/` | PATCH | `{is_owner, is_renter}` | Updated user |

The JWT payload includes `email`, `full_name`, `is_owner`, `is_renter`, `verification_level`.

---

## Step 1: Auth API module

**File: `src/lib/api/auth.ts`**

```typescript
import { apiClient } from "./client";

export type UserMe = {
  id: string;
  email: string;
  phone: string;
  first_name: string;
  last_name: string;
  full_name: string;
  profile_photo: string | null;
  bio: string | null;
  is_renter: boolean;
  is_owner: boolean;
  verification_level: string;
  is_phone_verified: boolean;
  is_email_verified: boolean;
  is_id_verified: boolean;
  created_at: string;
};

export type LoginResponse = {
  access: string;
  refresh: string;
  user: {
    id: string;
    email: string;
    full_name: string;
    is_owner: boolean;
    is_renter: boolean;
    verification_level: string;
  };
};

export type RegisterPayload = {
  email: string;
  phone: string;
  first_name: string;
  last_name: string;
  password: string;
  password_confirm: string;
};

export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post<LoginResponse>("/auth/login/", { email, password }),

  register: (payload: RegisterPayload) =>
    apiClient.post<{ success: true; data: { id: string; email: string; tokens: { access: string; refresh: string } } }>(
      "/auth/register/",
      payload,
    ),

  refresh: (refresh: string) =>
    apiClient.post<{ access: string }>("/auth/token/refresh/", { refresh }),

  logout: () => apiClient.post<{ success: true }>("/auth/logout/"),

  verifyPhone: (otp_code: string) =>
    apiClient.post<{ success: true }>("/auth/verify-phone/", { otp_code }),

  resendOtp: () => apiClient.post<{ success: true }>("/auth/resend-otp/"),

  changePassword: (old_password: string, new_password: string, new_password_confirm: string) =>
    apiClient.post<{ success: true }>("/auth/password/change/", {
      old_password,
      new_password,
      new_password_confirm,
    }),

  requestPasswordReset: (email: string) =>
    apiClient.post<{ success: true }>("/auth/password/reset/", { email }),

  confirmPasswordReset: (email: string, otp_code: string, new_password: string) =>
    apiClient.post<{ success: true }>("/auth/password/reset/confirm/", {
      email,
      otp_code,
      new_password,
    }),
};
```

**File: `src/lib/api/users.ts`**

```typescript
import { apiClient } from "./client";
import type { UserMe } from "./auth";

export const usersApi = {
  me: () => apiClient.get<{ success: true; data: UserMe }>("/users/me/"),

  updateRole: (is_owner: boolean, is_renter: boolean) =>
    apiClient.patch<{ success: true; data: UserMe }>("/users/me/role/", {
      is_owner,
      is_renter,
    }),

  uploadDocument: (file: File, document_type: "government_id" | "business_registration") => {
    const fd = new FormData();
    fd.append("document_file", file);
    fd.append("document_type", document_type);
    return apiClient.upload<{ success: true; data: { id: string; status: string } }>(
      "/users/me/documents/",
      fd,
    );
  },
};
```

---

## Step 2: Server session (httpOnly cookies)

The access token sits in memory + localStorage for the typed client, but middleware needs a **server-readable** signal of "user is signed in and is an owner". We mirror the access token (or just a flag) into an httpOnly cookie set by Next.js route handlers.

**File: `src/lib/auth/session.ts`**

```typescript
import { cookies } from "next/headers";

const NAME = process.env.SESSION_COOKIE_NAME ?? "terminal_session";
const SECURE = process.env.SESSION_COOKIE_SECURE === "true";

export type SessionPayload = {
  access: string;
  refresh: string;
  user: {
    id: string;
    email: string;
    full_name: string;
    is_owner: boolean;
    is_renter: boolean;
    verification_level: string;
  };
};

export async function setSession(payload: SessionPayload) {
  const c = await cookies();
  c.set(NAME, JSON.stringify(payload), {
    httpOnly: true,
    secure: SECURE,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days, matches refresh lifetime
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const c = await cookies();
  const raw = c.get(NAME)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionPayload;
  } catch {
    return null;
  }
}

export async function clearSession() {
  const c = await cookies();
  c.delete(NAME);
}
```

> Storing the access token inside an httpOnly cookie is acceptable for an MVP. The browser can never read it (good); the Next.js server reads it when proxying. The browser-side `apiClient` still holds an in-memory copy obtained via `/api/auth/me`. If you want stricter defense, in a later wave proxy **every** API call through Next.js route handlers — but that's overkill for v1.

---

## Step 3: Route handlers for login / logout / refresh

**File: `src/app/api/auth/login/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { setSession } from "@/lib/auth/session";
import { API_BASE_URL, API_PREFIX } from "@/lib/constants";

export async function POST(req: Request) {
  const { email, password } = (await req.json()) as { email: string; password: string };

  const res = await fetch(`${API_BASE_URL}${API_PREFIX}/auth/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();
  if (!res.ok) {
    return NextResponse.json({ error: data }, { status: res.status });
  }

  if (!data.user?.is_owner) {
    return NextResponse.json(
      { error: { detail: "This account is not enabled as an owner. Enable the owner role and try again." } },
      { status: 403 },
    );
  }

  await setSession({
    access: data.access,
    refresh: data.refresh,
    user: data.user,
  });

  return NextResponse.json({ ok: true, user: data.user, access: data.access, refresh: data.refresh });
}
```

**File: `src/app/api/auth/logout/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { clearSession, getSession } from "@/lib/auth/session";
import { API_BASE_URL, API_PREFIX } from "@/lib/constants";

export async function POST() {
  const session = await getSession();
  if (session) {
    await fetch(`${API_BASE_URL}${API_PREFIX}/auth/logout/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access}`,
      },
    }).catch(() => undefined);
  }
  await clearSession();
  return NextResponse.json({ ok: true });
}
```

**File: `src/app/api/auth/refresh/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { getSession, setSession } from "@/lib/auth/session";
import { API_BASE_URL, API_PREFIX } from "@/lib/constants";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "no session" }, { status: 401 });

  const res = await fetch(`${API_BASE_URL}${API_PREFIX}/auth/token/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh: session.refresh }),
  });

  if (!res.ok) return NextResponse.json({ error: "refresh failed" }, { status: 401 });

  const data = (await res.json()) as { access: string };
  await setSession({ ...session, access: data.access });
  return NextResponse.json({ ok: true, access: data.access });
}
```

---

## Step 4: Next.js middleware — owner route guard

**File: `src/middleware.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/verify-phone",
  "/forgot-password",
  "/reset-password",
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isApi = pathname.startsWith("/api/");
  const isStatic =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?)$/);
  if (isApi || isStatic) return NextResponse.next();

  const session = req.cookies.get(process.env.SESSION_COOKIE_NAME ?? "terminal_session");
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!session && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (session && isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

---

## Step 5: Auth Zustand-free hook (use TanStack Query as source of truth)

We don't need a global auth store — `useQuery(["me"])` is the single source of truth for "who is signed in" on the client. The server-side cookie is the source of truth for routing.

**File: `src/hooks/useAuth.ts`**

```typescript
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { authApi, type UserMe } from "@/lib/api/auth";
import { usersApi } from "@/lib/api/users";
import { setTokens, loadTokensFromStorage } from "@/lib/api/client";
import { QUERY_KEYS } from "@/lib/constants";

export function useMe() {
  return useQuery({
    queryKey: QUERY_KEYS.me,
    queryFn: async () => {
      loadTokensFromStorage();
      const res = await usersApi.me();
      return res.data;
    },
    staleTime: 60_000,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async (input: { email: string; password: string; next?: string }) => {
      // First, hit our route handler so the httpOnly cookie is set.
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: input.email, password: input.password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data?.error?.detail ?? data?.error?.errors?.non_field_errors?.[0] ?? "Sign-in failed.",
        );
      }
      setTokens(data.access, data.refresh);
      return { next: input.next ?? "/dashboard", user: data.user as UserMe };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.me });
      router.replace(data.next);
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: async () => {
      await fetch("/api/auth/logout", { method: "POST" });
      setTokens(null, null);
    },
    onSuccess: () => {
      qc.clear();
      router.replace("/login");
    },
  });
}

export const authMutations = { authApi };
```

---

## Step 6: TDS-skinned UI primitives

Drop these in `src/components/ui/`. Each is a thin wrapper around a Radix primitive or a styled `<input>`/`<button>`. **Every component is opinionated to TDS** — no theme variants, no light mode.

**File: `src/components/ui/Button.tsx`**

```typescript
"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "@radix-ui/react-slot";
import * as React from "react";
import { cn } from "@/lib/cn";

const button = cva(
  "inline-flex items-center justify-center gap-2 font-body font-medium select-none " +
    "rounded transition-colors duration-fast ease-standard " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forge focus-visible:ring-offset-2 focus-visible:ring-offset-abyss " +
    "disabled:opacity-40 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        primary:
          "bg-forge text-text-on-accent hover:bg-forge-light active:bg-forge-mid",
        secondary:
          "bg-surface-elevated text-text-primary border border-border hover:bg-surface-high",
        ghost: "bg-transparent text-text-primary hover:bg-surface-high",
        danger: "bg-alert text-text-on-accent hover:bg-alert-soft",
        link: "bg-transparent text-forge underline-offset-2 hover:underline px-0",
      },
      size: {
        sm: "h-8 px-3 text-[13px]",
        md: "h-10 px-4 text-[14px]",
        lg: "h-12 px-5 text-[15px]",
      },
      fullWidth: { true: "w-full" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, fullWidth, asChild, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(button({ variant, size, fullWidth }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
```

**File: `src/components/ui/Input.tsx`**

```typescript
import * as React from "react";
import { cn } from "@/lib/cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-10 w-full rounded border bg-surface-elevated px-3 text-text-primary font-body",
        "placeholder:text-text-tertiary",
        "focus:outline-none focus:border-border-active",
        invalid ? "border-alert" : "border-border",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
```

**File: `src/components/ui/Label.tsx`**

```typescript
"use client";

import * as React from "react";
import * as RLabel from "@radix-ui/react-label";
import { cn } from "@/lib/cn";

export const Label = React.forwardRef<
  React.ElementRef<typeof RLabel.Root>,
  React.ComponentPropsWithoutRef<typeof RLabel.Root>
>(({ className, ...props }, ref) => (
  <RLabel.Root
    ref={ref}
    className={cn(
      "text-[11px] font-medium uppercase tracking-[0.06em] text-text-secondary",
      className,
    )}
    {...props}
  />
));
Label.displayName = "Label";
```

**File: `src/components/ui/Field.tsx`**

```typescript
"use client";

import { Label } from "./Label";
import { cn } from "@/lib/cn";

export function Field({
  id,
  label,
  error,
  hint,
  children,
  className,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p className="text-[12px] text-alert-soft font-body">{error}</p>
      ) : hint ? (
        <p className="text-[12px] text-text-tertiary font-body">{hint}</p>
      ) : null}
    </div>
  );
}
```

---

## Step 7: Login page

**File: `src/app/(auth)/login/page.tsx`**

```typescript
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Field } from "@/components/ui/Field";
import { useLogin } from "@/hooks/useAuth";

const schema = z.object({
  email: z.string().email("Enter a valid email."),
  password: z.string().min(1, "Password is required."),
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const sp = useSearchParams();
  const next = sp.get("next") ?? "/dashboard";
  const login = useLogin();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = (v: FormValues) =>
    login.mutateAsync({ email: v.email, password: v.password, next });

  return (
    <div className="space-y-8">
      <div>
        <div className="font-display uppercase text-[36px] leading-none tracking-tight">
          Terminal
        </div>
        <p className="text-text-secondary mt-2">Owner sign-in.</p>
      </div>

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
          <p className="text-[13px] text-alert-soft">
            {(login.error as Error).message}
          </p>
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
```

---

## Step 8: Register page

**File: `src/app/(auth)/register/page.tsx`**

```typescript
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { authApi } from "@/lib/api/auth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Field } from "@/components/ui/Field";
import { setTokens } from "@/lib/api/client";

const schema = z
  .object({
    first_name: z.string().min(1, "Required."),
    last_name: z.string().min(1, "Required."),
    email: z.string().email("Enter a valid email."),
    phone: z.string().min(10, "Use a Nigerian phone number."),
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
    mutationFn: (v: FormValues) => authApi.register(v),
    onSuccess: async (res, vars) => {
      // The register endpoint returns tokens. Persist them and start the OTP flow.
      const tokens = (res as any).data?.tokens ?? (res as any).tokens;
      if (tokens?.access && tokens?.refresh) {
        setTokens(tokens.access, tokens.refresh);
      }
      // Mirror to httpOnly cookie via login route so middleware sees the session.
      await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: vars.email, password: vars.password }),
      });
      router.replace("/verify-phone");
    },
  });

  const {
    register: rhf,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  return (
    <div className="space-y-8">
      <div>
        <div className="font-display uppercase text-[36px] leading-none tracking-tight">
          Create owner account
        </div>
        <p className="text-text-secondary mt-2">
          You'll verify your phone right after.
        </p>
      </div>

      <form
        onSubmit={handleSubmit((v) => register.mutate(v))}
        className="space-y-5"
        noValidate
      >
        <div className="grid grid-cols-2 gap-4">
          <Field id="first_name" label="First name" error={errors.first_name?.message}>
            <Input id="first_name" invalid={!!errors.first_name} {...rhf("first_name")} />
          </Field>
          <Field id="last_name" label="Last name" error={errors.last_name?.message}>
            <Input id="last_name" invalid={!!errors.last_name} {...rhf("last_name")} />
          </Field>
        </div>

        <Field id="email" label="Email" error={errors.email?.message}>
          <Input id="email" type="email" invalid={!!errors.email} {...rhf("email")} />
        </Field>

        <Field id="phone" label="Phone" hint="Used for OTP verification." error={errors.phone?.message}>
          <Input id="phone" type="tel" invalid={!!errors.phone} placeholder="+234…" {...rhf("phone")} />
        </Field>

        <Field id="password" label="Password" error={errors.password?.message}>
          <Input id="password" type="password" invalid={!!errors.password} {...rhf("password")} />
        </Field>

        <Field id="password_confirm" label="Confirm password" error={errors.password_confirm?.message}>
          <Input
            id="password_confirm"
            type="password"
            invalid={!!errors.password_confirm}
            {...rhf("password_confirm")}
          />
        </Field>

        {register.error ? (
          <p className="text-[13px] text-alert-soft">
            {(register.error as Error).message}
          </p>
        ) : null}

        <Button type="submit" fullWidth size="lg" disabled={register.isPending}>
          {register.isPending ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="text-[13px] text-text-secondary text-center">
        Already have an account?{" "}
        <Link href="/login" className="text-forge">
          Sign in
        </Link>
      </p>
    </div>
  );
}
```

---

## Step 9: Verify phone (OTP)

**File: `src/app/(auth)/verify-phone/page.tsx`**

```typescript
"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api/auth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Field } from "@/components/ui/Field";
import { QUERY_KEYS } from "@/lib/constants";

export default function VerifyPhonePage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [code, setCode] = useState("");

  const verify = useMutation({
    mutationFn: (otp: string) => authApi.verifyPhone(otp),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.me });
      router.replace("/dashboard");
    },
  });

  const resend = useMutation({ mutationFn: () => authApi.resendOtp() });

  return (
    <div className="space-y-8">
      <div>
        <div className="font-display uppercase text-[36px] leading-none tracking-tight">
          Verify phone
        </div>
        <p className="text-text-secondary mt-2">
          Enter the 6-digit code we sent to your phone.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          verify.mutate(code);
        }}
        className="space-y-5"
      >
        <Field id="otp" label="OTP code" error={verify.error ? (verify.error as Error).message : undefined}>
          <Input
            id="otp"
            inputMode="numeric"
            maxLength={6}
            className="font-mono tracking-[0.4em] text-center text-[20px]"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />
        </Field>

        <Button type="submit" fullWidth size="lg" disabled={code.length < 6 || verify.isPending}>
          {verify.isPending ? "Verifying…" : "Verify"}
        </Button>
      </form>

      <div className="flex items-center justify-between text-[13px]">
        <span className="text-text-tertiary">Didn't get a code?</span>
        <button
          onClick={() => resend.mutate()}
          className="text-forge disabled:opacity-40"
          disabled={resend.isPending || resend.isSuccess}
        >
          {resend.isSuccess ? "Sent." : resend.isPending ? "Sending…" : "Resend"}
        </button>
      </div>
    </div>
  );
}
```

---

## Step 10: Forgot / reset password

**File: `src/app/(auth)/forgot-password/page.tsx`**

```typescript
"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api/auth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Field } from "@/components/ui/Field";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");

  const reset = useMutation({
    mutationFn: () => authApi.requestPasswordReset(email),
    onSuccess: () => {
      router.replace(`/reset-password?email=${encodeURIComponent(email)}`);
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <div className="font-display uppercase text-[36px] leading-none tracking-tight">
          Reset password
        </div>
        <p className="text-text-secondary mt-2">
          We'll text you a 6-digit code.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          reset.mutate();
        }}
        className="space-y-5"
      >
        <Field id="email" label="Email">
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>

        <Button type="submit" fullWidth size="lg" disabled={!email || reset.isPending}>
          {reset.isPending ? "Sending…" : "Send code"}
        </Button>
      </form>
    </div>
  );
}
```

**File: `src/app/(auth)/reset-password/page.tsx`**

```typescript
"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { authApi } from "@/lib/api/auth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Field } from "@/components/ui/Field";

export default function ResetPasswordPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const [email] = useState(sp.get("email") ?? "");
  const [otp, setOtp] = useState("");
  const [pwd, setPwd] = useState("");

  const confirm = useMutation({
    mutationFn: () => authApi.confirmPasswordReset(email, otp, pwd),
    onSuccess: () => router.replace("/login"),
  });

  return (
    <div className="space-y-8">
      <div>
        <div className="font-display uppercase text-[36px] leading-none tracking-tight">
          New password
        </div>
        <p className="text-text-secondary mt-2">
          Enter the code and your new password.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          confirm.mutate();
        }}
        className="space-y-5"
      >
        <Field id="email" label="Email">
          <Input id="email" value={email} disabled />
        </Field>

        <Field id="otp" label="OTP code">
          <Input
            id="otp"
            inputMode="numeric"
            maxLength={6}
            className="font-mono tracking-[0.4em] text-center"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
          />
        </Field>

        <Field id="pwd" label="New password">
          <Input id="pwd" type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} />
        </Field>

        {confirm.error ? (
          <p className="text-[13px] text-alert-soft">
            {(confirm.error as Error).message}
          </p>
        ) : null}

        <Button type="submit" fullWidth size="lg" disabled={otp.length < 6 || pwd.length < 8 || confirm.isPending}>
          {confirm.isPending ? "Updating…" : "Update password"}
        </Button>
      </form>
    </div>
  );
}
```

---

## Step 11: Owner-protected layout

**File: `src/app/(owner)/layout.tsx`**

```typescript
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.user.is_owner) {
    redirect("/login?next=/dashboard&error=owner_required");
  }
  return <>{children}</>;
}
```

**File: `src/app/(owner)/dashboard/page.tsx`** (placeholder until Wave 02)

```typescript
"use client";

import { useMe } from "@/hooks/useAuth";
import { useLogout } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";

export default function DashboardPage() {
  const me = useMe();
  const logout = useLogout();
  return (
    <main className="min-h-screen p-8 space-y-6">
      <h1 className="font-display uppercase text-[36px]">Welcome</h1>
      <pre className="font-mono text-[13px] bg-surface p-4 border border-border rounded-card">
        {JSON.stringify(me.data, null, 2)}
      </pre>
      <Button variant="secondary" onClick={() => logout.mutate()}>
        Sign out
      </Button>
    </main>
  );
}
```

---

## Step 12: Smoke test

Backend running on `localhost:8000` with at least one test user with `is_owner=true`.

```bash
npm run dev
```

1. Open `http://localhost:3000/login` — page loads, dark theme
2. Sign in with a non-owner account → expect `403` with message "This account is not enabled as an owner. Enable the owner role and try again."
3. Sign in with an owner account → redirected to `/dashboard`, JSON of `me` renders, Sign out works
4. Navigate to `/register` while signed in → middleware redirects to `/dashboard`
5. Open `/forgot-password`, request a code, follow to `/reset-password?email=...`, complete the flow
6. Refresh `/dashboard` after waiting >7 days of access token TTL (simulate by clearing `tw_access` in localStorage) — the silent refresh in `apiClient` must restore the session without bouncing to `/login`

---

## Step 13: Commit

```bash
git add owner-web/src
git commit -m "owner-web: auth flow + httpOnly session + UI primitives — Wave 01"
```

---

## Definition of Done

- [ ] `src/lib/api/auth.ts` exposes `login`, `register`, `refresh`, `logout`, `verifyPhone`, `resendOtp`, `changePassword`, `requestPasswordReset`, `confirmPasswordReset`
- [ ] `src/lib/api/users.ts` exposes `me`, `updateRole`, `uploadDocument`
- [ ] `src/lib/auth/session.ts` reads/writes the httpOnly `terminal_session` cookie
- [ ] Route handlers exist at `/api/auth/login`, `/api/auth/logout`, `/api/auth/refresh`
- [ ] `src/middleware.ts` redirects unauthenticated users from `/dashboard`, `/listings`, `/bookings`, `/messages`, `/analytics`, `/settings` to `/login`, and signed-in users from auth pages back to `/dashboard`
- [ ] Non-owner accounts are rejected at login with a clear, terse message
- [ ] `src/components/ui/Button.tsx`, `Input.tsx`, `Label.tsx`, `Field.tsx` exist and follow TDS exactly (Forge dark, 4px radius for buttons, sentence-case labels uppercase via `Label` style)
- [ ] Login, Register, Verify-phone, Forgot-password, Reset-password pages all functional end-to-end against the live backend
- [ ] `/dashboard` placeholder shows the signed-in user's JSON and offers Sign out
- [ ] `useMe()`, `useLogin()`, `useLogout()` hooks work without crashes on first render
- [ ] All copy follows TDS voice: no "Oops", no emoji, no exclamation marks, sentence case
- [ ] `npm run typecheck` and `npm run lint` pass
- [ ] Git commit `owner-web: auth flow + httpOnly session + UI primitives — Wave 01` is made
