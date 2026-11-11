import { getStoredToken } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8006";

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  interview_id: string | null;
  read_at: string | null;
  created_at: string;
};

export type NotificationList = {
  unread_count: number;
  items: AppNotification[];
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? "Request failed.");
  }
  return res.json();
}

export async function listNotifications(): Promise<NotificationList> {
  const data = await request<Partial<NotificationList> | null>("/notifications");
  // A reply in an unexpected shape must not crash the bell: treat it like any other failed check.
  if (!data || !Array.isArray(data.items)) throw new Error("Unexpected notifications response.");
  return { unread_count: typeof data.unread_count === "number" ? data.unread_count : 0, items: data.items };
}

export function markNotificationRead(id: string): Promise<AppNotification> {
  return request(`/notifications/${id}/read`, { method: "POST" });
}

export function markAllNotificationsRead(): Promise<{ detail: string }> {
  return request("/notifications/read-all", { method: "POST" });
}

/** The API returns naive UTC timestamps (no "Z"); parse them as UTC. */
export function notificationTime(iso: string): number {
  return Date.parse(/(Z|[+-]\d\d:?\d\d)$/.test(iso) ? iso : `${iso}Z`);
}
