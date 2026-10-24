"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { HomeIcon } from "@/components/dashboard/navIcons";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTheme } from "@/contexts/ThemeContext";
import { logout, type AuthUser } from "@/lib/auth";
import { getAdminPalette } from "./adminStyles";

const TABS = [
  { label: "Organizations", href: "/super-admin" },
  { label: "Analytics", href: "/super-admin/analytics" },
  { label: "Settings", href: "/super-admin/settings" },
];

export function SuperAdminShell({ user, children }: { user: AuthUser; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme } = useTheme();
  const palette = getAdminPalette(theme);

  function handleLogout() {
    logout();
    router.push("/super-admin/login");
  }

  return (
    <div style={{ minHeight: "100vh", background: palette.bg, color: palette.textPrimary, transition: "background 0.15s ease, color 0.15s ease" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 28px",
          borderBottom: `1px solid ${palette.border}`,
          background: palette.headerBg,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Logo size={30} radius={8} />
          <div>
            <div style={{ fontSize: "14px", fontWeight: 800, letterSpacing: "-0.02em", color: palette.textPrimary }}>
              Nextenti Admin
            </div>
            <div
              style={{
                fontSize: "9.5px",
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: palette.accent,
              }}
            >
              Super Admin Console
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "12px", fontWeight: 700, color: palette.textPrimary }}>{user.full_name}</div>
            <div style={{ fontSize: "11px", color: palette.textMuted }}>{user.email}</div>
          </div>
          <Link
            href="/"
            title="Go to the Nextenti homepage"
            style={{
              ...palette.secondaryButton,
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              textDecoration: "none",
            }}
          >
            <HomeIcon size={14} />
            Main Site
          </Link>
          <ThemeToggle />
          <button type="button" onClick={handleLogout} style={{ ...palette.secondaryButton, padding: "8px 14px" }}>
            Log out
          </button>
        </div>
      </header>

      <nav
        style={{
          display: "flex",
          gap: "4px",
          padding: "0 28px",
          borderBottom: `1px solid ${palette.border}`,
          background: palette.headerBg,
        }}
      >
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              style={{
                padding: "12px 6px",
                marginRight: "22px",
                fontSize: "13px",
                fontWeight: 700,
                textDecoration: "none",
                color: active ? palette.accent : palette.textSecondary,
                borderBottom: active ? `2px solid ${palette.accent}` : "2px solid transparent",
              }}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <main style={{ maxWidth: "1100px", margin: "0 auto", padding: "32px 28px 64px" }}>{children}</main>
    </div>
  );
}
