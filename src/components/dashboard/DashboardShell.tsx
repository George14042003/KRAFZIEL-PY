"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import styles from "./DashboardShell.module.css";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { logout, type AuthUser } from "@/lib/auth";
import {
  BriefcaseIcon,
  CalendarIcon,
  ChartIcon,
  DashboardIcon,
  HomeIcon,
  JobsIcon,
  ScorecardIcon,
  SettingsIcon,
  TutorialIcon,
  UserIcon,
  UsersIcon,
} from "./navIcons";

type DashboardShellProps = {
  user: AuthUser;
  children: ReactNode;
  /** Constrain content to the viewport height on desktop instead of scrolling the page (e.g. a KPI dashboard). */
  fitToScreen?: boolean;
  /** Sidebar module list. Defaults to the employer modules. */
  nav?: NavItem[];
};

export type NavItem = {
  label: string;
  href: string;
  icon: (props: { size?: number; color?: string }) => React.ReactElement;
  soon?: boolean;
};

export const EMPLOYER_NAV: NavItem[] = [
  { label: "Dashboard", href: "/employer", icon: DashboardIcon },
  { label: "Jobs", href: "/employer/jobs", icon: JobsIcon },
  { label: "Candidate Pool", href: "/employer/candidates", icon: UsersIcon },
  { label: "Interviews", href: "/employer/interviews", icon: CalendarIcon },
  { label: "Offers", href: "/employer/offers", icon: BriefcaseIcon },
  { label: "Reports & Analytics", href: "/employer/reports", icon: ChartIcon },
  { label: "Tutorial", href: "/#tutorial", icon: TutorialIcon },
  { label: "Settings", href: "/employer/settings", icon: SettingsIcon },
];

export const CANDIDATE_NAV: NavItem[] = [
  { label: "Dashboard", href: "/candidate", icon: DashboardIcon },
  { label: "Jobs", href: "/candidate/jobs", icon: JobsIcon },
  { label: "My Interviews", href: "/candidate/interviews", icon: CalendarIcon },
  { label: "Scorecards", href: "/candidate/scorecards", icon: ScorecardIcon },
  { label: "My Offers", href: "/candidate/offers", icon: BriefcaseIcon },
  { label: "Profile", href: "/candidate/profile", icon: UserIcon },
  { label: "Tutorial", href: "/#tutorial", icon: TutorialIcon },
  { label: "Settings", href: "/candidate/settings", icon: SettingsIcon },
];

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export function DashboardShell({ user, children, fitToScreen = false, nav = EMPLOYER_NAV }: DashboardShellProps) {
  const router = useRouter();
  const pathname = usePathname();

  function handleLogout() {
    logout();
    router.push("/login");
  }

  return (
    <div className={`${styles.shell} ${fitToScreen ? styles.shellFit : ""}`}>
      <aside className={styles.sidebar}>
        <Link href="/" className={styles.sidebarBrand} title="Go to main website">
          <Logo size={30} radius={8} />
          <div className={styles.sidebarBrandLockup}>
            <span className={styles.sidebarBrandName}>Nextenti</span>
            <span className={styles.sidebarBrandTagline}>Talent Flow</span>
          </div>
        </Link>

        <p className={styles.modulesLabel}>Modules</p>
        <nav className={styles.navList}>
          {nav.map((item) => {
            const active = !item.soon && pathname === item.href;
            const Icon = item.icon;

            if (item.soon) {
              return (
                <span key={item.label} className={`${styles.navItem} ${styles.navItemDisabled}`}>
                  <Icon size={16} />
                  {item.label}
                  <span className={styles.soonBadge}>Soon</span>
                </span>
              );
            }

            return (
              <Link
                key={item.label}
                href={item.href}
                className={`${styles.navItem} ${active ? styles.navItemActive : ""}`}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.avatar}>{initialsFor(user.full_name)}</div>
          <div className={styles.sidebarFooterText}>
            <span className={styles.userName}>{user.full_name}</span>
            <span className={styles.sidebarFooterRole}>{user.role}</span>
          </div>
        </div>
      </aside>

      <div className={`${styles.mainColumn} ${fitToScreen ? styles.mainColumnFit : ""}`}>
        <header className={styles.header}>
          <Link href="/" className={styles.mobileBrand} title="Go to main website">
            <Logo size={26} radius={7} />
            <span className={styles.brandName}>Nextenti</span>
          </Link>

          <div className={styles.userMenu}>
            <span className={styles.roleBadge}>{user.role}</span>
            <div className={styles.avatarMobile}>{initialsFor(user.full_name)}</div>
            <div className={styles.userText}>
              <span className={styles.userName}>{user.full_name}</span>
              <span className={styles.userEmail}>{user.email}</span>
            </div>
            <Link href="/" className={styles.homeButton} title="Go to main website home page">
              <HomeIcon size={14} />
              <span className={styles.homeButtonLabel}>Main Site</span>
            </Link>
            <ThemeToggle />
            <button type="button" className={styles.logoutButton} onClick={handleLogout}>
              Log out
            </button>
          </div>
        </header>

        <main className={`${styles.main} ${fitToScreen ? styles.mainFit : ""}`}>{children}</main>
      </div>
    </div>
  );
}
