"use client";

import { useCallback, useEffect, useState } from "react";
import { AuroraLoading } from "@/components/aurora/AuroraLoading";
import { AuroraPageHeader } from "@/components/aurora/AuroraPageHeader";
import styles from "@/components/aurora/aurora.module.css";
import { useSession } from "@/hooks/useSession";
import { formatMoney, MODE_LABELS, type InterviewMode, type PlanKey } from "@/lib/billing";
import {
  assignPlan,
  getCatalog,
  getOverview,
  listAllPayments,
  OFFER_MODES,
  PLAN_KEYS,
  resetCatalog,
  saveCatalog,
  type AdminPayment,
  type Catalog,
  type OrgSubscription,
  type Overview,
} from "@/lib/billingAdmin";
import local from "./subscriptions.module.css";

type Tab = "organizations" | "setup" | "payments";

const dateText = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "—");
const limitText = (n: number | null) => (n === null ? "∞" : n.toLocaleString("en-IN"));

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className={`${styles.glass} ${local.stat}`}>
      <div className={local.statLabel}>{label}</div>
      <div className={local.statValue}>{value}</div>
      {sub && <div className={local.muted}>{sub}</div>}
    </div>
  );
}

/** "used / limit" cell, red when the limit is reached. */
function Usage({ used, limit }: { used: number; limit: number | null }) {
  const full = limit !== null && used >= limit;
  return (
    <span className={full ? local.full : undefined}>
      {used.toLocaleString("en-IN")} / {limitText(limit)}
    </span>
  );
}

// ---------- Organizations tab ----------

function AssignForm({ org, onDone, onError }: { org: OrgSubscription; onDone: () => void; onError: (m: string) => void }) {
  const [plan, setPlan] = useState<PlanKey>(org.plan);
  const [mode, setMode] = useState<InterviewMode>(org.mode);
  const [interval, setInterval] = useState<"month" | "year">(org.interval ?? "month");
  const [days, setDays] = useState("30");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      const n = days.trim() === "" ? undefined : Number(days);
      await assignPlan(org.organization_id, { plan, mode, interval, days: n });
      onDone();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not assign the plan.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={local.assign}>
      <label>
        Plan
        <select value={plan} onChange={(e) => setPlan(e.target.value as PlanKey)}>
          {PLAN_KEYS.map((k) => (
            <option key={k} value={k}>
              {k[0].toUpperCase() + k.slice(1)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Pack
        <select value={mode} onChange={(e) => setMode(e.target.value as InterviewMode)} disabled={plan === "free"}>
          {OFFER_MODES.map((m) => (
            <option key={m} value={m}>
              {MODE_LABELS[m]}
            </option>
          ))}
        </select>
      </label>
      <label>
        Billing
        <select value={interval} onChange={(e) => setInterval(e.target.value as "month" | "year")} disabled={plan === "free"}>
          <option value="month">Monthly</option>
          <option value="year">Annual</option>
        </select>
      </label>
      <label>
        Days (blank = no end)
        <input inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, ""))} disabled={plan === "free"} />
      </label>
      <button type="button" className={local.btnPrimary} disabled={busy} onClick={submit}>
        {busy ? "Saving…" : plan === "free" ? "Move to Free" : "Assign plan"}
      </button>
    </div>
  );
}

function OrganizationsTab({ overview, reload, onError }: { overview: Overview; reload: () => void; onError: (m: string) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const t = overview.totals;
  return (
    <>
      <div className={local.stats}>
        <Stat label="Monthly recurring revenue" value={formatMoney(t.mrr_paise)} sub="gateway-paid plans, at current prices" />
        <Stat label="Paid organizations" value={`${t.paid_organizations} / ${t.organizations}`} />
        <Stat label="Collected, last 30 days" value={formatMoney(t.collected_30d_paise)} />
        <Stat label="Needs attention" value={t.past_due + t.failed_30d} sub={`${t.past_due} past due · ${t.failed_30d} failed payments`} />
      </div>

      <div className={`${styles.glass} ${local.panel}`}>
        <div className={local.tableWrap}>
          <table className={local.table}>
            <thead>
              <tr>
                <th>Organization</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Renews / ends</th>
                <th>Jobs</th>
                <th>Candidates</th>
                <th>Bot</th>
                <th>Video</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {overview.organizations.map((o) => (
                <FragmentRow key={o.organization_id} org={o} isOpen={open === o.organization_id} toggle={() => setOpen(open === o.organization_id ? null : o.organization_id)} reload={reload} onError={onError} />
              ))}
              {overview.organizations.length === 0 && (
                <tr>
                  <td colSpan={9} className={local.muted}>
                    No organizations yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function FragmentRow({ org, isOpen, toggle, reload, onError }: { org: OrgSubscription; isOpen: boolean; toggle: () => void; reload: () => void; onError: (m: string) => void }) {
  return (
    <>
      <tr>
        <td>
          <b>{org.organization_name}</b>
          {org.organization_status === "suspended" && <span className={`${local.pill} ${local.s_past_due}`}>suspended</span>}
        </td>
        <td>
          {org.plan_name}
          {org.plan !== "free" && <span className={local.sub}> · {MODE_LABELS[org.mode]}</span>}
          {org.assigned_by_admin && <span className={local.pill}>manual</span>}
        </td>
        <td>
          <span className={`${local.pill} ${local[`s_${org.status}`] ?? ""}`}>{org.status.replace("_", " ")}</span>
        </td>
        <td>{org.plan === "free" ? "—" : `${org.cancel_at_period_end ? "Ends " : ""}${dateText(org.current_period_end)}`}</td>
        <td><Usage used={org.usage.jobs} limit={org.limits.jobs} /></td>
        <td><Usage used={org.usage.candidates} limit={org.limits.candidates} /></td>
        <td><Usage used={org.usage.bot_interviews} limit={org.limits.bot_interviews} /></td>
        <td><Usage used={org.usage.video_interviews} limit={org.limits.video_interviews} /></td>
        <td>
          <button type="button" className={local.btn} onClick={toggle} aria-expanded={isOpen}>
            {isOpen ? "Close" : "Change plan"}
          </button>
        </td>
      </tr>
      {isOpen && (
        <tr>
          <td colSpan={9} className={local.assignCell}>
            <AssignForm org={org} onDone={reload} onError={onError} />
          </td>
        </tr>
      )}
    </>
  );
}

// ---------- Setup tab ----------

const toRupees = (paise: number) => String(paise / 100);
const toPaise = (rupees: string) => Math.round(Number(rupees) * 100);

function SetupTab({ initial, isCustom, onSaved, onError }: { initial: Catalog; isCustom: boolean; onSaved: (c: Catalog, custom: boolean) => void; onError: (m: string) => void }) {
  const [draft, setDraft] = useState<Catalog>(() => structuredClone(initial));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => setDraft(structuredClone(initial)), [initial]);

  function patchPlan(key: PlanKey, fn: (p: Catalog["plans"][PlanKey]) => void) {
    setSaved(false);
    setDraft((d) => {
      const next = structuredClone(d);
      fn(next.plans[key]);
      return next;
    });
  }

  function num(v: string): number {
    return v === "" ? 0 : Math.max(0, Math.floor(Number(v) || 0));
  }

  async function save() {
    setBusy(true);
    try {
      const res = await saveCatalog(draft);
      onSaved(res.catalog, res.is_custom);
      setSaved(true);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not save pricing.");
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (!window.confirm("Reset all plans and prices to the built-in defaults?")) return;
    setBusy(true);
    try {
      const res = await resetCatalog();
      onSaved(res.catalog, res.is_custom);
      setSaved(true);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not reset pricing.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className={`${styles.glass} ${local.panel} ${local.setupTop}`}>
        <div>
          <b>Price template (INR)</b>
          <div className={local.muted}>
            Edits apply to the pricing page, checkout and plan limits straight away. Customers already subscribed keep what they are paying until they change plan.
            {isCustom ? " Using your saved prices." : " Using the built-in defaults."}
          </div>
        </div>
        <label className={local.inline}>
          Annual discount (%)
          <input
            inputMode="decimal"
            value={String(Math.round(draft.annual_discount * 1000) / 10)}
            onChange={(e) => {
              setSaved(false);
              setDraft({ ...draft, annual_discount: Math.min(90, Math.max(0, Number(e.target.value) || 0)) / 100 });
            }}
          />
        </label>
      </div>

      {PLAN_KEYS.map((key) => {
        const p = draft.plans[key];
        return (
          <section key={key} className={`${styles.glass} ${local.panel}`}>
            <div className={local.planHead}>
              <label className={local.inline}>
                Plan name
                <input value={p.name} maxLength={40} onChange={(e) => patchPlan(key, (pl) => (pl.name = e.target.value))} />
              </label>
              <label className={local.inline}>
                Active jobs (blank = unlimited)
                <input
                  inputMode="numeric"
                  value={p.limits.jobs ?? ""}
                  onChange={(e) => patchPlan(key, (pl) => (pl.limits.jobs = e.target.value === "" ? null : num(e.target.value)))}
                />
              </label>
              <label className={local.inline}>
                Candidates (blank = unlimited)
                <input
                  inputMode="numeric"
                  value={p.limits.candidates ?? ""}
                  onChange={(e) => patchPlan(key, (pl) => (pl.limits.candidates = e.target.value === "" ? null : num(e.target.value)))}
                />
              </label>
            </div>
            <div className={local.tableWrap}>
              <table className={local.table}>
                <thead>
                  <tr>
                    <th>Pack</th>
                    <th>Price / month (₹)</th>
                    <th>Bot interviews / month</th>
                    <th>Video interviews / month</th>
                  </tr>
                </thead>
                <tbody>
                  {OFFER_MODES.map((m) => {
                    const o = p.offers[m];
                    return (
                      <tr key={m}>
                        <th scope="row">{MODE_LABELS[m]}</th>
                        <td>
                          <input
                            inputMode="decimal"
                            value={toRupees(o.monthly_paise)}
                            disabled={key === "free"}
                            onChange={(e) => patchPlan(key, (pl) => (pl.offers[m].monthly_paise = toPaise(e.target.value.replace(/[^\d.]/g, ""))))}
                          />
                        </td>
                        <td>
                          <input inputMode="numeric" value={o.bot} disabled={m === "video"} onChange={(e) => patchPlan(key, (pl) => (pl.offers[m].bot = num(e.target.value)))} />
                        </td>
                        <td>
                          <input inputMode="numeric" value={o.video} disabled={m === "bot"} onChange={(e) => patchPlan(key, (pl) => (pl.offers[m].video = num(e.target.value)))} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      <div className={local.actions}>
        <button type="button" className={local.btnPrimary} disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Save pricing"}
        </button>
        <button type="button" className={local.btn} disabled={busy} onClick={reset}>
          Reset to defaults
        </button>
        {saved && <span className={local.ok}>Saved.</span>}
      </div>
    </>
  );
}

// ---------- Payments tab ----------

function PaymentsTab({ payments }: { payments: AdminPayment[] }) {
  return (
    <div className={`${styles.glass} ${local.panel}`}>
      {payments.length === 0 ? (
        <div className={local.muted}>No payments yet.</div>
      ) : (
        <div className={local.tableWrap}>
          <table className={local.table}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Organization</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Invoice</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td>{dateText(p.paid_at ?? p.created_at)}</td>
                  <td>{p.organization_name}</td>
                  <td>{p.description ?? "Subscription"}</td>
                  <td>{formatMoney(p.amount_cents, p.currency)}</td>
                  <td>
                    <span className={`${local.pill} ${local[`s_${p.status}`] ?? ""}`}>{p.status}</span>
                  </td>
                  <td>
                    {p.invoice_url ? (
                      <a href={p.invoice_url} target="_blank" rel="noreferrer">
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
    </div>
  );
}

// ---------- page ----------

export function SubscriptionsClient() {
  const { user, loading } = useSession("super_admin");
  const [tab, setTab] = useState<Tab>("organizations");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [catalog, setCatalog] = useState<{ catalog: Catalog; isCustom: boolean } | null>(null);
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  const load = useCallback(() => {
    setError(null);
    return Promise.all([getOverview(), getCatalog(), listAllPayments()])
      .then(([o, c, p]) => {
        setOverview(o);
        setCatalog({ catalog: c.catalog, isCustom: c.is_custom });
        setPayments(p);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load subscriptions."))
      .finally(() => setDataLoading(false));
  }, []);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  if (loading || !user) return <AuroraLoading />;

  return (
    <>
      <AuroraPageHeader eyebrow="Platform" title="Subscriptions" subtitle="Set up plans and prices, and monitor every organization's subscription." />

      {error && (
        <p className={local.error} role="alert">
          {error}
        </p>
      )}

      <div className={local.tabs} role="tablist">
        {([["organizations", "Organizations"], ["setup", "Setup"], ["payments", "Payments"]] as [Tab, string][]).map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? local.tabOn : local.tab} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>

      {dataLoading ? (
        <div className={local.muted}>Loading subscriptions…</div>
      ) : (
        <>
          {tab === "organizations" && overview && <OrganizationsTab overview={overview} reload={load} onError={setError} />}
          {tab === "setup" && catalog && (
            <SetupTab
              initial={catalog.catalog}
              isCustom={catalog.isCustom}
              onSaved={(c, custom) => {
                setCatalog({ catalog: c, isCustom: custom });
                void getOverview().then(setOverview);
              }}
              onError={setError}
            />
          )}
          {tab === "payments" && <PaymentsTab payments={payments} />}
        </>
      )}
    </>
  );
}
