import type { Theme } from "@/contexts/ThemeContext";

export type AuthPalette = ReturnType<typeof getAuthPalette>;

export function getAuthPalette(theme: Theme) {
  const dark = theme === "dark";

  return {
    cardBg: dark ? "rgba(17, 24, 39, 0.82)" : "rgba(255,255,255,0.94)",
    cardBorder: dark ? "1px solid rgba(255,255,255,0.14)" : "1px solid rgba(255,255,255,0.6)",
    heading: dark ? "#f8fafc" : "#0f172a",
    subheading: dark ? "rgba(226,232,240,0.65)" : "#64748b",
    label: dark ? "rgba(226,232,240,0.8)" : "#334155",
    mutedText: dark ? "rgba(226,232,240,0.55)" : "#94a3b8",
    checkboxText: dark ? "rgba(226,232,240,0.75)" : "#475569",

    tabWrapBg: dark ? "rgba(255,255,255,0.06)" : "#f1f5f9",
    tabActiveBg: dark ? "rgba(255,255,255,0.14)" : "#fff",
    tabActiveText: dark ? "#7dd3fc" : "#01617a",
    tabInactiveText: dark ? "rgba(226,232,240,0.55)" : "#64748b",
    tabActiveShadow: dark ? "none" : "0 1px 3px rgba(0,0,0,.08)",

    inputBg: dark ? "rgba(255,255,255,0.06)" : "#f8fafc",
    inputBorder: dark ? "1px solid rgba(255,255,255,0.16)" : "1px solid #e2e8f0",
    inputText: dark ? "#f1f5f9" : "#0f172a",

    dividerLine: dark ? "rgba(255,255,255,0.14)" : "#e2e8f0",
    dividerText: dark ? "rgba(226,232,240,0.5)" : "#94a3b8",

    googleBg: dark ? "rgba(255,255,255,0.06)" : "#fff",
    googleBorder: dark ? "1px solid rgba(255,255,255,0.16)" : "1px solid #e2e8f0",
    googleText: dark ? "#f1f5f9" : "#334155",

    link: dark ? "#7dd3fc" : "#01617a",
    iconCircleBg: dark ? "rgba(125,211,252,0.16)" : "#e0f2fe",
  };
}
