import { getStoredToken } from "./auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8006";

export type OrganizationStatus = "active" | "suspended";

export type Organization = {
  id: string;
  name: string;
  status: OrganizationStatus;
  created_at: string;
  updated_at: string;
  employer_count: number;
  candidate_count: number;
  job_count: number;
};

export type CreateOrganizationPayload = {
  name: string;
  admin_email: string;
  admin_full_name: string;
  admin_password: string;
};

export type UpdateOrganizationPayload = {
  name?: string;
  status?: OrganizationStatus;
};

function authHeaders(): Record<string, string> {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? "Request failed.");
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return res.json();
}

export function listOrganizations(): Promise<Organization[]> {
  return request("/admin/organizations");
}

export function getOrganization(id: string): Promise<Organization> {
  return request(`/admin/organizations/${id}`);
}

export function createOrganization(payload: CreateOrganizationPayload): Promise<Organization> {
  return request("/admin/organizations", { method: "POST", body: JSON.stringify(payload) });
}

export function updateOrganization(
  id: string,
  payload: UpdateOrganizationPayload
): Promise<Organization> {
  return request(`/admin/organizations/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export function deleteOrganization(id: string): Promise<void> {
  return request(`/admin/organizations/${id}`, { method: "DELETE" });
}
