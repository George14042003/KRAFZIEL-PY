import { getStoredToken } from "./auth";
import type { InterviewMode, PlanKey } from "./billing";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8006";

export const PLAN_KEYS: PlanKey[] = ["free", "starter", "growth", "enterprise"];
export const OFFER_MODES: InterviewMode[] = ["bot", "video", "both"];

export type CatalogOffer = { monthly_paise: number; bot: number; video: number };
export type CatalogPlan = {
  name: string;
  limits: { jobs: number | null; candidates: number | null };
  offers: Record<InterviewMode, CatalogOffer>;
};
export type Catalog = { annual_discount: number; plans: Record<PlanKey, CatalogPlan> };
export type CatalogResponse = { currency: string; catalog: Catalog; is_custom: boolean; updated_at: string | null };

export type OrgSubscription = {
  organization_id: string;
  organization_name: string;
  organization_status: "active" | "suspended";
  plan: PlanKey;
  plan_name: string;
  mode: InterviewMode;
  status: "free" | "active" | "trialing" | "past_due" | "canceled" | "incomplete";
  interval: "month" | "year" | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  assigned_by_admin: boolean;
  monthly_paise: number;
  limits: { jobs: number | null; candidates: number | null; bot_interviews: number; video_interviews: number };
  usage: { jobs: number; candidates: number; bot_interviews: number; video_interviews: number };
};

export type Overview = {
  currency: string;
  totals: {
    organizations: number;
    paid_organizations: number;
    mrr_paise: number;
    collected_30d_paise: number;
    failed_30d: number;
    past_due: number;
  };
  organizations: OrgSubscription[];
};

export type AdminPayment = {
  id: string;
  organization_name: string;
  amount_cents: number;
  currency: string;
  status: "paid" | "failed";
  description: string | null;
  invoice_url: string | null;
  paid_at: string | null;
  created_at: string;
};

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
    throw new Error(typeof body?.detail === "string" ? body.detail : `Request failed (HTTP ${res.status}).`);
  }
  return res.json() as Promise<T>;
}

export const getCatalog = () => request<CatalogResponse>("/admin/billing/catalog");
export const saveCatalog = (catalog: Catalog) =>
  request<CatalogResponse>("/admin/billing/catalog", { method: "PUT", body: JSON.stringify(catalog) });
export const resetCatalog = () => request<CatalogResponse>("/admin/billing/catalog", { method: "DELETE" });
export const getOverview = () => request<Overview>("/admin/billing/overview");
export const listAllPayments = () => request<AdminPayment[]>("/admin/billing/payments");
export const assignPlan = (orgId: string, body: { plan: PlanKey; mode: InterviewMode; interval: "month" | "year"; days?: number }) =>
  request<{ plan: string; plan_name: string }>(`/admin/billing/organizations/${orgId}/plan`, { method: "PUT", body: JSON.stringify(body) });
