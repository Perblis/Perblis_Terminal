import { apiClient } from "./client";

export type ThreadParticipant = {
  id: string;
  full_name: string;
  profile_photo: string | null;
};

export type ThreadLastMessage = {
  body: string;
  sender_name: string;
  created_at: string;
} | null;

export type ThreadSummary = {
  id: string;
  is_booking_thread: boolean;
  booking_id: string | null;
  listing_id: string | null;
  listing_title: string | null;
  other_participant: ThreadParticipant | null;
  last_message: ThreadLastMessage;
  unread_count: number;
  created_at: string;
  updated_at: string;
};

export type MessageSender = {
  id: string;
  full_name: string;
  profile_photo: string | null;
};

export type Message = {
  id: string;
  sender: MessageSender;
  body: string;
  is_read: boolean;
  created_at: string;
};

export type ThreadDetailResponse = {
  success: true;
  thread: ThreadSummary;
  messages: Message[];
};

export type ThreadListResponse = {
  count: number;
  next: string | null;
  previous: string | null;
  results: ThreadSummary[];
};

export type AblyTokenData = {
  token: string | null;
  expires: number | null;
  client_id: string;
};

export const messagingApi = {
  listThreads: (filters: { thread_type?: string; unread?: boolean } = {}) =>
    apiClient.get<ThreadListResponse>("/threads/", {
      query: filters as Record<string, string | number | boolean | undefined | null>,
    }),

  getThread: (id: string) => apiClient.get<ThreadDetailResponse>(`/threads/${id}/`),

  send: (id: string, body: string) =>
    apiClient.post<{ success: true; data: Message }>(`/threads/${id}/messages/`, { body }),

  markRead: (id: string) =>
    apiClient.patch<{ success: true; messages_marked_read: number }>(`/threads/${id}/read/`),

  createInquiry: (listing_id: string, initial_message: string) =>
    apiClient.post<{ success: true; data: ThreadSummary }>("/threads/", {
      listing_id,
      initial_message,
    }),

  ablyToken: () =>
    apiClient.post<{ success: true; token: AblyTokenData }>("/threads/token/"),
};
