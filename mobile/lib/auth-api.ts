// F1 auth calls (accounts app, Wave 1 contracts — frozen). All public
// endpoints; login stores the JWT pair in SecureStore via lib/api.ts.
import { apiFetch, clearTokens, setTokens } from "./api";
import type { Me } from "./types";

export type RegisterPayload = {
  full_name: string;
  email: string;
  phone: string;
  password: string;
  accept_tos: true;
  accept_privacy: true;
};

export async function register(payload: RegisterPayload): Promise<Me> {
  return apiFetch<Me>("/auth/register", { method: "POST", body: payload });
}

export async function verifyPhoneOtp(phone: string, code: string): Promise<void> {
  await apiFetch("/auth/otp/verify", { method: "POST", body: { phone, code } });
}

export async function resendPhoneOtp(phone: string): Promise<void> {
  await apiFetch("/auth/otp/resend", { method: "POST", body: { phone } });
}

export async function verifyEmailOtp(email: string, code: string): Promise<void> {
  await apiFetch("/auth/email/verify", { method: "POST", body: { email, code } });
}

export async function resendEmailOtp(email: string): Promise<void> {
  await apiFetch("/auth/email/resend", { method: "POST", body: { email } });
}

export async function login(email: string, password: string): Promise<void> {
  const pair = await apiFetch<{ access: string; refresh: string }>("/auth/login", {
    method: "POST",
    body: { email, password },
  });
  await setTokens(pair.access, pair.refresh);
}

export async function fetchMe(): Promise<Me> {
  return apiFetch<Me>("/me");
}

export async function logout(): Promise<void> {
  try {
    await apiFetch("/auth/logout", { method: "POST", body: {} });
  } catch {
    // Best-effort blacklist; local sign-out always proceeds.
  }
  await clearTokens();
}
