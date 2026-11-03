import { getStoredToken } from "./auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8006";

export type BillingInterval = "month" | "year";
export type InterviewMode = "bot" | "video" | "both";
export type PlanKey = "free" | "starter" | "growth" | "enterprise";
export type PaidPlanKey = Exclude<PlanKey, "free">;

export const MODE_LABELS: Record<InterviewMode, string> = {
  bot: "Bot interviews",
  video: "Video interviews",
  both: "Bot + video",
};

export type PlanOffer = {
  monthly_paise: number;
  annual_paise: number;
  bot_interviews: number;
  video_interviews: number;
};

export type BillingPlan = {
  key: PlanKey;
  name: string;
  limits: { jobs: number | null; candidates: number | null };
  offers: Record<InterviewMode, PlanOffer>;
};

export type PaymentGateway = "none" | "stripe";

export type PlanCatalog = {
  currency: string;
  annual_discount: number;
  plans: BillingPlan[];
  /** True while no payment gateway is configured: plans are bought as a demo subscription with no payment. */
  demo_mode: boolean;
  gateway: PaymentGateway;
};

export const DEMO_NOTICE = "Demo subscription. No payment is taken. Online payments (Razorpay) are coming soon.";

export type SubscriptionInfo = {
  plan: PlanKey;
  plan_name: string;
  mode: InterviewMode;
  limits: { jobs: number | null; candidates: number | null; bot_interviews: number | null; video_interviews: number | null };
  limits_enforced: boolean;
  status: "free" | "active" | "trialing" | "past_due" | "canceled" | "incomplete";
  interval: BillingInterval | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  assigned_by_admin: boolean;
  gateway_configured: boolean;
  /** The active subscription is a demo one (no payment taken). */
  demo: boolean;
  demo_available: boolean;
  gateway: PaymentGateway;
  usage: { jobs: number; candidates: number; bot_interviews: number; video_interviews: number };
};

export type PaymentRow = {
  id: string;
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
    throw new Error(typeof body?.detail === "string" && body.detail ? body.detail : `Request failed (HTTP ${res.status}).`);
  }
  return res.json() as Promise<T>;
}

export const listPlans = () => request<PlanCatalog>("/billing/plans");
export const getSubscription = () => request<SubscriptionInfo>("/billing/subscription");
export const listPayments = () => request<PaymentRow[]>("/billing/payments");
export const startCheckout = (plan: PaidPlanKey, mode: InterviewMode, interval: BillingInterval) =>
  request<{ url: string }>("/billing/checkout", { method: "POST", body: JSON.stringify({ plan, mode, interval }) });
export const demoSubscribe = (plan: PlanKey, mode: InterviewMode, interval: BillingInterval) =>
  request<SubscriptionInfo>("/billing/demo-subscribe", { method: "POST", body: JSON.stringify({ plan, mode, interval }) });
export const demoCancel = () => request<SubscriptionInfo>("/billing/demo-cancel", { method: "POST" });
export const openBillingPortal = () => request<{ url: string }>("/billing/portal", { method: "POST" });

/** Amounts from the API are in the smallest unit (paise); shown as whole rupees when there are no fractions. */
export function formatMoney(paise: number, currency = "inr"): string {
  const whole = paise % 100 === 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(paise / 100);
}

/** What one offer includes, e.g. "150 bot + 75 video interviews / month". */
export function offerSummary(o: PlanOffer): string {
  if (o.bot_interviews && o.video_interviews) return `${o.bot_interviews.toLocaleString("en-IN")} bot + ${o.video_interviews.toLocaleString("en-IN")} video interviews / month`;
  if (o.bot_interviews) return `${o.bot_interviews.toLocaleString("en-IN")} bot interviews / month`;
  return `${o.video_interviews.toLocaleString("en-IN")} video interviews / month`;
}
