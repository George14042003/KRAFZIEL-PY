"use client";

import { useEffect, useRef, useState } from "react";
import { AuroraPageHeader } from "@/components/aurora/AuroraPageHeader";
import styles from "@/components/aurora/aurora.module.css";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { useSession } from "@/hooks/useSession";
import {
  DEMO_NOTICE,
  demoCancel,
  demoSubscribe,
  formatMoney,
  getSubscription,
  listPayments,
  listPlans,
  MODE_LABELS,
  offerSummary,
  openBillingPortal,
  startCheckout,
  type BillingInterval,
  type InterviewMode,
  type PaidPlanKey,
  type PaymentRow,
  type PlanCatalog,
  type PlanKey,
  type SubscriptionInfo,
} from "@/lib/billing";
import local from "./billing.module.css";

const MODES: InterviewMode[] = ["bot", "video", "both"];
const dateText = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "—");
const count = (n: number | null) => (n === null ? "Unlimited" : n.toLocaleString("en-IN"));

export function BillingClient() {
  const { user, loading } = useSession("employer");
  const [catalog, setCatalog] = useState<PlanCatalog | null>(null);
  const [sub, setSub] = useState<SubscriptionInfo | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [interval, setInterval] = useState<BillingInterval>("month");
  const [mode, setMode] = useState<InterviewMode>("both");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<PlanKey | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const inFlight = useRef(false);

  const uid = user?.id;
  const loadedFor = useRef<string | number | null>(null);

  useEffect(() => {
    // useSession swaps the stored user for the /auth/me object; load once per user, not per object.
    if (uid === undefined || loadedFor.current === uid) return;
    loadedFor.current = uid;
    const q = new URLSearchParams(window.location.search);
    const checkout = q.get("checkout");
    if (checkout === "success") setNotice("Payment received. Your plan updates as soon as the gateway confirms it.");
    if (checkout === "cancelled") setNotice("Checkout cancelled. You have not been charged.");
    const qMode = q.get("mode");
    const qInterval = q.get("interval");
    const qPlan = q.get("plan");
    const validMode = qMode === "bot" || qMode === "video" || qMode === "both";
    const validInterval = qInterval === "month" || qInterval === "year";
    if (validMode) setMode(qMode);
    if (validInterval) setInterval(qInterval);
    if (qPlan === "free" || qPlan === "starter" || qPlan === "growth" || qPlan === "enterprise") setSelectedPlan(qPlan);
    Promise.all([listPlans(), getSubscription(), listPayments()])
      .then(([c, s, pay]) => {
        setCatalog(c);
        setSub(s);
        setPayments(pay);
        // Without an explicit choice in the link, start from the pack the organization already has.
        if (s.limits_enforced && s.demo) {
          if (!validMode) setMode(s.mode);
          if (!validInterval && s.interval) setInterval(s.interval);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load billing."))
      .finally(() => setDataLoading(false));
  }, [uid]);

  useEffect(() => {
    if (dataLoading || !selectedPlan) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(`plan-${selectedPlan}`)?.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
  }, [dataLoading, selectedPlan]);

  async function go(key: string, fn: () => Promise<{ url: string }>) {
    setBusy(key);
    setError(null);
    try {
      window.location.href = (await fn()).url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(null);
    }
  }

  async function runDemo(key: string, fn: () => Promise<SubscriptionInfo>, success: (next: SubscriptionInfo) => string) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      const next = await fn();
      setSub(next);
      setConfirmCancel(false);
      setNotice(success(next));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  }

  if (loading || !user) {
    return <div className={local.loading}>Loading…</div>;
  }

  const subscribed = sub !== null && sub.status !== "free" && sub.status !== "canceled" && sub.plan !== "free";
  const earlyAccess = sub !== null && !sub.limits_enforced;
  const isDemo = sub !== null && sub.demo && !earlyAccess;
  const adminAssigned = sub !== null && subscribed && sub.assigned_by_admin;
  const realLive = sub !== null && subscribed && !sub.demo && !adminAssigned;
  const canDemo = sub !== null && sub.demo_available && !realLive && !adminAssigned;
  const showDemoNotice = sub !== null && (sub.demo_available || sub.demo);

  return (
    <DashboardShell user={user}>
      <AuroraPageHeader eyebrow="Account" title="Subscriptions" subtitle="Monitor your plan, usage against your limits, and payment history (INR)." />

      {error && (
        <p className={local.error} role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className={`${local.notice} ${local.success}`} role="status">
          {notice}
        </p>
      )}
      {showDemoNotice && (
        <p className={local.demoBanner}>
          <span className={local.demoBadge}>Demo subscription</span>
          {DEMO_NOTICE}
        </p>
      )}
      {sub && !sub.gateway_configured && !sub.demo_available && (
        <p className={local.notice}>Online payments are not configured on this server yet, so checkout is unavailable.</p>
      )}

      {dataLoading || !catalog ? (
        <div className={local.muted}>Loading billing…</div>
      ) : (
        <>
          {sub && (
            <section className={`${styles.glass} ${styles.card} ${local.current}`}>
              <div className={local.currentMain}>
                <div className={local.label}>Current plan</div>
                <div className={local.planName}>
                  {sub.plan_name}
                  {isDemo && <span className={`${local.pill} ${local.demoPill}`}>Demo</span>}
                  {!earlyAccess && <span className={`${local.pill} ${local[`s_${sub.status}`] ?? ""}`}>{sub.status.replace("_", " ")}</span>}
                </div>
                <div className={local.muted}>
                  {earlyAccess
                    ? "You are on early access with no limits. Choose a plan to try its benefits."
                    : isDemo
                      ? `Demo plan active: the benefits of ${sub.plan_name} (${MODE_LABELS[sub.mode]} pack) apply to your organization${sub.current_period_end ? ` until ${dateText(sub.current_period_end)}` : ""}.`
                      : adminAssigned
                        ? `Plan provided by your administrator${sub.current_period_end ? ` until ${dateText(sub.current_period_end)}` : ""}.`
                        : `${MODE_LABELS[sub.mode]} pack · ${sub.cancel_at_period_end ? "Ends" : "Renews"} ${dateText(sub.current_period_end)} · billed ${sub.interval === "year" ? "annually" : "monthly"}`}
                </div>
                <ul className={local.usage} aria-label="Plan usage">
                  {(
                    [
                      ["Bot interviews this month", sub.usage.bot_interviews, sub.limits.bot_interviews],
                      ["Video interviews this month", sub.usage.video_interviews, sub.limits.video_interviews],
                      ["Active jobs", sub.usage.jobs, sub.limits.jobs],
                      ["Candidates", sub.usage.candidates, sub.limits.candidates],
                    ] as const
                  ).map(([label, used, limit]) => (
                    <li key={label}>
                      <div className={local.usageHead}>
                        <span>{label}</span>
                        <b>
                          {used.toLocaleString("en-IN")} of {count(limit)}
                        </b>
                      </div>
                      {limit !== null && (
                        <div
                          className={`${local.bar} ${used >= limit ? local.barFull : ""}`}
                          role="progressbar"
                          aria-label={label}
                          aria-valuemin={0}
                          aria-valuemax={limit}
                          aria-valuenow={Math.min(used, limit)}
                        >
                          <span style={{ width: `${limit === 0 ? 100 : Math.min(100, (used / limit) * 100)}%` }} />
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
              {isDemo && !confirmCancel && (
                <button type="button" className={local.btn} disabled={busy !== null} onClick={() => setConfirmCancel(true)}>
                  Cancel demo subscription
                </button>
              )}
              {isDemo && confirmCancel && (
                <div className={local.confirm} role="group" aria-label="Confirm cancellation">
                  <span>Cancel the demo and go back to unlimited early access?</span>
                  <div className={local.confirmBtns}>
                    <button
                      type="button"
                      className={`${local.btn} ${local.btnDanger}`}
                      disabled={busy !== null}
                      onClick={() => runDemo("cancel", demoCancel, () => "Demo subscription cancelled. You are back on early access with no limits.")}
                    >
                      {busy === "cancel" ? "Cancelling…" : "Yes, cancel demo"}
                    </button>
                    <button type="button" className={local.btn} disabled={busy !== null} onClick={() => setConfirmCancel(false)}>
                      Keep plan
                    </button>
                  </div>
                </div>
              )}
              {realLive && (
                <button type="button" className={local.btn} disabled={busy !== null} onClick={() => go("portal", openBillingPortal)}>
                  {busy === "portal" ? "Opening…" : "Manage billing"}
                </button>
              )}
            </section>
          )}

          <div className={local.toggleRow}>
            <div className={local.toggle} role="group" aria-label="Interview type">
              {MODES.map((m) => (
                <button key={m} type="button" aria-pressed={mode === m} className={mode === m ? local.on : ""} onClick={() => setMode(m)}>
                  {MODE_LABELS[m]}
                </button>
              ))}
            </div>
            <div className={local.toggle} role="group" aria-label="Billing interval">
              <button type="button" aria-pressed={interval === "month"} className={interval === "month" ? local.on : ""} onClick={() => setInterval("month")}>
                Monthly
              </button>
              <button type="button" aria-pressed={interval === "year"} className={interval === "year" ? local.on : ""} onClick={() => setInterval("year")}>
                Annual · save {Math.round(catalog.annual_discount * 100)}%
              </button>
            </div>
          </div>

          <div className={local.plans}>
            {catalog.plans.map((p) => {
              const offer = p.offers[mode];
              const price = interval === "year" ? Math.round(offer.annual_paise / 12) : offer.monthly_paise;
              const isFree = p.key === "free";
              const isCurrent =
                sub !== null && !earlyAccess && sub.plan === p.key && (isFree || (sub.mode === mode && (!sub.demo || sub.interval === interval)));
              const samePlan = sub !== null && !earlyAccess && !isFree && sub.plan === p.key;
              const demoLabel = isFree ? "Switch to Free" : isDemo ? (samePlan ? "Switch pack" : `Switch to ${p.name}`) : "Start demo subscription";
              const selected = selectedPlan === p.key && !isCurrent;
              return (
                <div
                  key={p.key}
                  id={`plan-${p.key}`}
                  className={`${styles.glass} ${styles.card} ${local.plan} ${isCurrent ? local.planCurrent : ""} ${selected ? local.planSelected : ""}`}
                >
                  <h2 className={local.planTitle}>
                    {p.name}
                    {selected && <span className={`${local.pill} ${local.demoPill}`}>Selected</span>}
                  </h2>
                  <div className={local.price}>
                    {isFree ? "₹0" : formatMoney(price)}
                    {!isFree && <span> / month</span>}
                  </div>
                  <div className={local.muted}>{!isFree && interval === "year" ? `${formatMoney(offer.annual_paise)} billed yearly` : " "}</div>
                  <ul className={local.limits}>
                    <li>
                      <b>{offerSummary(offer)}</b>
                    </li>
                    <li>{count(p.limits.jobs)} active jobs</li>
                    <li>{count(p.limits.candidates)} candidates</li>
                  </ul>
                  {canDemo ? (
                    <button
                      type="button"
                      className={`${local.btn} ${isFree ? "" : local.btnPrimary}`}
                      disabled={busy !== null || isCurrent}
                      onClick={() =>
                        runDemo(
                          p.key,
                          () => demoSubscribe(p.key, mode, interval),
                          (next) => `Demo subscription started: ${next.plan_name} plan. No payment was taken.`,
                        )
                      }
                    >
                      {isCurrent ? "Current plan" : busy === p.key ? "Applying…" : demoLabel}
                    </button>
                  ) : isFree ? (
                    <button type="button" className={local.btn} disabled>
                      {isCurrent ? "Current plan" : "Free plan"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={`${local.btn} ${local.btnPrimary}`}
                      disabled={busy !== null || isCurrent || subscribed || !sub?.gateway_configured}
                      onClick={() => go(p.key, () => startCheckout(p.key as PaidPlanKey, mode, interval))}
                    >
                      {isCurrent
                        ? "Current plan"
                        : busy === p.key
                          ? "Redirecting…"
                          : adminAssigned
                            ? "Set by administrator"
                            : subscribed
                              ? "Use Manage billing"
                              : `Choose ${p.name}`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <section className={`${styles.glass} ${styles.card}`}>
            <h2 className={local.planTitle}>Payment history</h2>
            {payments.length === 0 ? (
              <div className={local.muted}>No payments yet.</div>
            ) : (
              <div className={local.tableWrap}>
                <table className={local.table}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Description</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Invoice</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((r) => (
                      <tr key={r.id}>
                        <td>{dateText(r.paid_at ?? r.created_at)}</td>
                        <td>{r.description ?? "Subscription"}</td>
                        <td>{formatMoney(r.amount_cents, r.currency)}</td>
                        <td>
                          <span className={`${local.pill} ${local[`s_${r.status}`] ?? ""}`}>{r.status}</span>
                        </td>
                        <td>
                          {r.invoice_url ? (
                            <a href={r.invoice_url} target="_blank" rel="noreferrer">
                              View
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </DashboardShell>
  );
}
