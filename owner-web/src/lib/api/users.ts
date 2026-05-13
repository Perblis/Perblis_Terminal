import { apiClient } from "./client";
import type { UserMe } from "./auth";

export const usersApi = {
  me: () => apiClient.get<{ success: true; data: UserMe }>("/users/me/"),

  updateProfile: (payload: Partial<Pick<UserMe, "first_name" | "last_name" | "phone" | "bio">>) =>
    apiClient.patch<{ success: true; data: UserMe }>("/users/me/", payload),

  updateRole: (is_owner: boolean, is_renter: boolean) =>
    apiClient.patch<{ success: true; data: UserMe }>("/users/me/role/", {
      is_owner,
      is_renter,
    }),

  uploadDocument: (file: File, document_type: "government_id" | "business_registration") => {
    const fd = new FormData();
    fd.append("document_file", file);
    fd.append("document_type", document_type);
    return apiClient.upload<{
      success: true;
      data: { id: string; status: string };
    }>("/users/me/documents/", fd);
  },
};
