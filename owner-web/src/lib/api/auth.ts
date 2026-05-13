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
  verification_level: number | string;
  is_phone_verified: boolean;
  is_email_verified: boolean;
  is_id_verified: boolean;
  created_at: string;
};

export type SessionUser = {
  id: string;
  email: string;
  full_name: string;
  is_owner: boolean;
  is_renter: boolean;
  verification_level: number | string;
};

export type LoginResponse = {
  access: string;
  refresh: string;
  user: SessionUser;
};

export type RegisterPayload = {
  email: string;
  phone: string;
  first_name: string;
  last_name: string;
  password: string;
  password_confirm: string;
};

export type RegisterResponse = {
  success: true;
  message: string;
  tokens: { access: string; refresh: string };
  user: {
    id: string;
    email: string;
    full_name: string;
    is_owner: boolean;
    is_renter: boolean;
  };
};

export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post<LoginResponse>("/auth/login/", { email, password }),

  register: (payload: RegisterPayload) =>
    apiClient.post<RegisterResponse>("/auth/register/", payload),

  refresh: (refresh: string) =>
    apiClient.post<{ access: string }>("/auth/token/refresh/", { refresh }),

  logout: (refresh?: string) =>
    apiClient.post<{ success: true }>("/auth/logout/", refresh ? { refresh } : undefined),

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
