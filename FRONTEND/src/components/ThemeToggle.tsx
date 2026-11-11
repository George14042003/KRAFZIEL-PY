"use client";

import { useTheme } from "@/contexts/ThemeContext";

function SunIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx={12} cy={12} r={4.5} />
      <path d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8l1.8-1.8M18 6l1.8-1.8" />
    </svg>
  );
}

function MoonIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
    </svg>
  );
}

export function ThemeToggle({
  size = 36,
  variant = "boxed",
  iconColor,
}: {
  size?: number;
  variant?: "boxed" | "ghost";
  /** Fixed icon color, for use on a backdrop (e.g. a video) that isn't theme-reactive. */
  iconColor?: string;
}) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const isGhost = variant === "ghost";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "10px",
        border: isGhost ? "1px solid transparent" : "1px solid var(--chrome-border)",
        background: isGhost ? "transparent" : "var(--chrome-surface)",
        color: iconColor ?? "var(--chrome-text)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        flexShrink: 0,
        transition: "background 0.15s ease, transform 0.15s ease, border-color 0.15s ease",
      }}
      onMouseEnter={
        isGhost
          ? (e) => {
              e.currentTarget.style.background = iconColor ? "rgba(255,255,255,0.14)" : "var(--chrome-surface)";
              e.currentTarget.style.borderColor = iconColor ? "rgba(255,255,255,0.3)" : "var(--chrome-border)";
            }
          : undefined
      }
      onMouseLeave={
        isGhost
          ? (e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.borderColor = "transparent";
            }
          : undefined
      }
    >
      {isDark ? <SunIcon size={16} /> : <MoonIcon size={16} />}
    </button>
  );
}
