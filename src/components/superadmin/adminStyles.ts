import type { CSSProperties } from "react";
import type { Theme } from "@/contexts/ThemeContext";

// Deliberately distinct from the candidate/employer dashboard palette (teal/emerald) —
// an amber-accented "control room" look, signaling this is a different, more
// privileged surface of the app. Reacts to the same light/dark toggle as the
// rest of the site instead of being permanently dark.

export type AdminPalette = ReturnType<typeof getAdminPalette>;

export function getAdminPalette(theme: Theme) {
  const dark = theme === "dark";

  const bg = dark ? "#0a0f1a" : "#f1f5f9";
  const surface = dark ? "#1e293b" : "#ffffff";
  const surfaceRaised = dark ? "#151e2d" : "#ffffff";
  const headerBg = dark ? "#0f172a" : "#ffffff";
  const border = dark ? "#334155" : "#e2e8f0";
  const textPrimary = dark ? "#e2e8f0" : "#0f172a";
  const textSecondary = dark ? "#94a3b8" : "#64748b";
  const textMuted = dark ? "#64748b" : "#94a3b8";
  const accent = "#f59e0b";
  const inputBg = dark ? "#0f172a" : "#f8fafc";

  return {
    dark,
    bg,
    surface,
    surfaceRaised,
    headerBg,
    border,
    textPrimary,
    textSecondary,
    textMuted,
    accent,
    positive: dark ? "#4ade80" : "#15803d",
    positiveBg: dark ? "rgba(34,197,94,0.15)" : "rgba(21,128,61,0.1)",
    positiveBorder: dark ? "rgba(34,197,94,0.35)" : "rgba(21,128,61,0.3)",
    negative: dark ? "#f87171" : "#dc2626",
    negativeBg: dark ? "rgba(248,113,113,0.15)" : "rgba(220,38,38,0.1)",
    negativeBorder: dark ? "rgba(248,113,113,0.35)" : "rgba(220,38,38,0.3)",

    input: {
      width: "100%",
      padding: "10px 12px",
      background: inputBg,
      border: `1px solid ${border}`,
      borderRadius: "8px",
      fontSize: "13px",
      color: textPrimary,
      boxSizing: "border-box",
      fontFamily: "inherit",
    } satisfies CSSProperties,

    label: {
      display: "block",
      fontSize: "11px",
      fontWeight: 700,
      letterSpacing: "0.04em",
      textTransform: "uppercase",
      color: textSecondary,
      marginBottom: "6px",
    } satisfies CSSProperties,

    primaryButton: {
      padding: "10px 18px",
      background: "linear-gradient(135deg, #f59e0b, #b45309)",
      color: "#0f172a",
      border: "none",
      borderRadius: "8px",
      fontWeight: 800,
      fontSize: "13px",
      cursor: "pointer",
    } satisfies CSSProperties,

    secondaryButton: {
      padding: "10px 18px",
      background: "transparent",
      color: textPrimary,
      border: `1px solid ${dark ? "#475569" : "#cbd5e1"}`,
      borderRadius: "8px",
      fontWeight: 700,
      fontSize: "13px",
      cursor: "pointer",
    } satisfies CSSProperties,

    dangerButton: {
      padding: "10px 18px",
      background: "transparent",
      color: dark ? "#f87171" : "#dc2626",
      border: `1px solid ${dark ? "#7f1d1d" : "#fecaca"}`,
      borderRadius: "8px",
      fontWeight: 700,
      fontSize: "13px",
      cursor: "pointer",
    } satisfies CSSProperties,

    card: {
      background: surface,
      border: `1px solid ${border}`,
      borderRadius: "14px",
      padding: "20px",
    } satisfies CSSProperties,
  };
}

// Backwards-compatible static (dark-only) exports, kept for any code that
// hasn't migrated to the theme-aware getAdminPalette() yet.
const darkPalette = getAdminPalette("dark");
export const adminInputStyle = darkPalette.input;
export const adminLabelStyle = darkPalette.label;
export const adminPrimaryButtonStyle = darkPalette.primaryButton;
export const adminSecondaryButtonStyle = darkPalette.secondaryButton;
export const adminDangerButtonStyle = darkPalette.dangerButton;
export const adminCardStyle = darkPalette.card;
