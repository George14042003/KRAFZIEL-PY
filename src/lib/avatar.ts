import { getStoredToken } from "./auth";
import type { AvatarParams } from "./avatarTypes";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8006";

export type AvatarProfile = { params: AvatarParams | null; consent_at: string | null };

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(typeof body?.detail === "string" ? body.detail : "Request failed.");
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export function getMyAvatar(): Promise<AvatarProfile> {
  return request("/avatar/me");
}

export function saveMyAvatar(params: AvatarParams): Promise<AvatarProfile> {
  return request("/avatar/me", { method: "PUT", body: JSON.stringify({ params, consent: true }) });
}

export function deleteMyAvatar(): Promise<void> {
  return request("/avatar/me", { method: "DELETE" });
}
