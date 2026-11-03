"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import aurora from "@/components/aurora/aurora.module.css";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  notificationTime,
  type AppNotification,
} from "@/lib/notifications";

const POLL_INTERVAL_MS = 10_000;
const TOAST_LIFETIME_MS = 12_000;

type PermissionState = NotificationPermission | "unsupported";

function seenKey(userId: string): string {
  return `naie_last_seen_notification_${userId}`;
}

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - notificationTime(iso)) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function accentFor(type: string): string {
  if (type === "interview_accepted") return "#16a34a";
  if (type === "interview_declined") return "#dc2626";
  return "var(--pop-link)";
}

function BellIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 01-3.4 0" />
    </svg>
  );
}

/** Employer notification bell: unread badge + history dropdown, in-page toasts for new
 * items, and (once the employer enables them) native browser notifications that also
 * fire while the tab is in the background. Polls the API, so it works as long as a
 * dashboard tab is open. The newest item the employer has been alerted about is remembered
 * per browser, so alerts are not repeated on every page navigation. */
export function NotificationCenter({ userId }: { userId: string }) {
  const router = useRouter();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [toasts, setToasts] = useState<AppNotification[]>([]);
  const [permission, setPermission] = useState<PermissionState>("default");
  const lastSeenRef = useRef<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const openNotification = useCallback(
    (n: AppNotification) => {
      setOpen(false);
      dismissToast(n.id);
      if (!n.read_at) {
        setItems((current) => current.map((i) => (i.id === n.id ? { ...i, read_at: new Date().toISOString() } : i)));
        setUnread((count) => Math.max(0, count - 1));
        markNotificationRead(n.id).catch(() => {});
      }
      if (n.link) router.push(n.link);
    },
    [dismissToast, router]
  );

  useEffect(() => {
    setPermission(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  }, []);

  useEffect(() => {
    let cancelled = false;
    try {
      const stored = localStorage.getItem(seenKey(userId));
      lastSeenRef.current = stored ? Number(stored) : null;
    } catch {
      lastSeenRef.current = null;
    }

    function remember(value: number) {
      lastSeenRef.current = value;
      try {
        localStorage.setItem(seenKey(userId), String(value));
      } catch {}
    }

    async function check() {
      let data;
      try {
        data = await listNotifications();
      } catch {
        return; // transient network/auth error — try again on the next tick
      }
      if (cancelled) return;
      setItems(data.items);
      setUnread(data.unread_count);

      const newest = data.items.reduce((max, n) => Math.max(max, notificationTime(n.created_at)), 0);
      // First run in this browser: whatever already exists is history, not news.
      if (lastSeenRef.current === null) {
        remember(newest);
        return;
      }

      const fresh = data.items
        .filter((n) => !n.read_at && notificationTime(n.created_at) > (lastSeenRef.current ?? 0))
        .sort((a, b) => notificationTime(a.created_at) - notificationTime(b.created_at));
      if (newest > lastSeenRef.current) remember(newest);
      if (fresh.length === 0) return;

      const tabInBackground = document.hidden || !document.hasFocus();
      if (!tabInBackground) {
        setToasts((current) => [...current, ...fresh]);
        for (const n of fresh) window.setTimeout(() => dismissToast(n.id), TOAST_LIFETIME_MS);
      }
      if (typeof Notification !== "undefined" && Notification.permission === "granted" && tabInBackground) {
        for (const n of fresh) {
          const native = new Notification(n.title, {
            body: n.body,
            tag: n.id,
            icon: "/logo.png",
          });
          native.onclick = () => {
            window.focus();
            native.close();
            openNotification(n);
          };
        }
      }
    }

    void check();
    const timer = window.setInterval(check, POLL_INTERVAL_MS);
    document.addEventListener("visibilitychange", check);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [userId, dismissToast, openNotification]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  async function enableDesktopNotifications() {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") {
      new Notification("Desktop notifications enabled", {
        body: "You'll be alerted here when candidates respond to interviews.",
        icon: "/logo.png",
      });
    }
  }

  async function readAll() {
    setItems((current) => current.map((i) => ({ ...i, read_at: i.read_at ?? new Date().toISOString() })));
    setUnread(0);
    markAllNotificationsRead().catch(() => {});
  }

  return (
    <>
      <div ref={rootRef} style={{ position: "relative" }}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
          aria-expanded={open}
          style={{
            position: "relative",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 40,
            height: 40,
            borderRadius: 10,
            border: "1px solid var(--chrome-border)",
            background: "var(--chrome-surface)",
            color: "var(--chrome-text)",
            cursor: "pointer",
          }}
        >
          <span className={unread > 0 ? aurora.bellRing : undefined} style={{ display: "inline-flex" }}>
            <BellIcon />
          </span>
          {unread > 0 && (
            <span
              key={unread}
              className={aurora.badgePop}
              style={{
                position: "absolute",
                top: -5,
                right: -5,
                minWidth: 18,
                height: 18,
                padding: "0 5px",
                borderRadius: 999,
                background: "#dc2626",
                color: "#fff",
                fontSize: 10.5,
                fontWeight: 800,
                lineHeight: "18px",
                textAlign: "center",
              }}
            >
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>

        {open && (
          <div
            role="dialog"
            className={aurora.popIn}
            aria-label="Notifications"
            style={{
              position: "absolute",
              top: "calc(100% + 10px)",
              right: 0,
              zIndex: 1001,
              width: "min(380px, calc(100vw - 32px))",
              maxHeight: 460,
              overflowY: "auto",
              background: "var(--pop-bg)",
              color: "var(--pop-text)",
              borderRadius: 14,
              boxShadow: "var(--pop-shadow)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid var(--pop-line)" }}>
              <strong style={{ fontSize: 14 }}>Notifications</strong>
              <button
                type="button"
                onClick={readAll}
                disabled={unread === 0}
                style={{ border: 0, background: "transparent", color: "var(--pop-link)", fontWeight: 700, fontSize: 12, cursor: unread === 0 ? "default" : "pointer", opacity: unread === 0 ? 0.4 : 1 }}
              >
                Mark all read
              </button>
            </div>

            {permission === "default" && (
              <div style={{ padding: "10px 16px", background: "var(--pop-soft)", fontSize: 12.5, display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
                <span>Get alerted even when this tab is in the background.</span>
                <button
                  type="button"
                  onClick={enableDesktopNotifications}
                  style={{ border: 0, borderRadius: 8, padding: "7px 12px", background: "var(--accent)", color: "var(--on-accent)", fontWeight: 700, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  Enable
                </button>
              </div>
            )}
            {permission === "denied" && (
              <div style={{ padding: "10px 16px", background: "var(--pop-warn-bg)", color: "var(--pop-warn-text)", fontSize: 12 }}>
                Desktop notifications are blocked. Allow them for this site in your browser&apos;s address bar settings.
              </div>
            )}

            {items.length === 0 ? (
              <p style={{ padding: "28px 16px", textAlign: "center", fontSize: 13, color: "var(--pop-muted)" }}>
                No notifications yet. You&apos;ll see candidate responses here.
              </p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => openNotification(n)}
                  style={{
                    display: "flex",
                    gap: 10,
                    width: "100%",
                    textAlign: "left",
                    padding: "12px 16px",
                    border: 0,
                    borderBottom: "1px solid var(--pop-line)",
                    background: n.read_at ? "var(--pop-bg)" : "var(--pop-unread)",
                    color: "inherit",
                    cursor: "pointer",
                    font: "inherit",
                  }}
                >
                  <span style={{ flexShrink: 0, width: 8, height: 8, marginTop: 6, borderRadius: 999, background: n.read_at ? "transparent" : accentFor(n.type) }} />
                  <span style={{ flex: 1 }}>
                    <span style={{ display: "block", fontSize: 13, fontWeight: 800, color: accentFor(n.type) }}>{n.title}</span>
                    <span style={{ display: "block", fontSize: 12.5, lineHeight: 1.45, marginTop: 2 }}>{n.body}</span>
                    <span style={{ display: "block", fontSize: 11, color: "var(--pop-muted)", marginTop: 4 }}>{timeAgo(n.created_at)}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {toasts.length > 0 && (
        <div
          aria-live="polite"
          style={{
            position: "fixed",
            top: 76,
            right: 20,
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            gap: 10,
            width: "min(380px, calc(100vw - 40px))",
          }}
        >
          {toasts.map((n) => (
            <div
              key={n.id}
              role="status"
              className={aurora.toastIn}
              style={{
                background: "var(--pop-bg)",
                color: "var(--pop-text)",
                borderLeft: `4px solid ${accentFor(n.type)}`,
                borderRadius: 12,
                padding: "14px 16px",
                boxShadow: "var(--pop-shadow)",
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
              }}
            >
              <div style={{ flex: 1, fontSize: 13.5, lineHeight: 1.5 }}>
                <div style={{ fontWeight: 800, color: accentFor(n.type), marginBottom: 2 }}>{n.title}</div>
                <div>{n.body}</div>
                <button
                  type="button"
                  onClick={() => openNotification(n)}
                  style={{ marginTop: 6, padding: 0, border: 0, background: "transparent", fontWeight: 700, color: "var(--pop-link)", cursor: "pointer", font: "inherit" }}
                >
                  View
                </button>
              </div>
              <button
                type="button"
                onClick={() => dismissToast(n.id)}
                aria-label="Dismiss notification"
                style={{ border: 0, background: "transparent", fontSize: 18, lineHeight: 1, cursor: "pointer", color: "var(--pop-muted)" }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
