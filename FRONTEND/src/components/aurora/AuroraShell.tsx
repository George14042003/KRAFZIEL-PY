"use client";

import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { usePathname, useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { logout, type AuthUser } from "@/lib/auth";
import { OPEN_EDITION_HOME, OPEN_EDITION_PATHS, setOpenEdition, useOpenEdition } from "@/lib/edition";
import { NotificationCenter } from "@/components/dashboard/NotificationCenter";
import { ThemeToggle } from "@/components/ThemeToggle";
import { EMPLOYER_AURORA_NAV, type AuroraNavItem } from "./auroraNav";
import styles from "./aurora.module.css";

export { EMPLOYER_AURORA_NAV as AURORA_NAV };

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

function isActive(pathname: string, href: string, nav: AuroraNavItem[]): boolean {
  if (href.includes("#")) return false;
  // The shortest href in the nav is the area root ("/employer"): match it exactly only.
  const root = nav.reduce((shortest, n) => (n.href.length < shortest.length ? n.href : shortest), nav[0].href);
  if (href === root) return pathname === root;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AuroraShell({
  user,
  children,
  nav: fullNav = EMPLOYER_AURORA_NAV,
  roleLabel = "Employer",
  brandHref = "/employer",
  logoutTo = "/login",
  bell = true,
}: {
  user: AuthUser;
  children: ReactNode;
  nav?: AuroraNavItem[];
  roleLabel?: string;
  brandHref?: string;
  logoutTo?: string;
  bell?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const openEdition = useOpenEdition() && (user.role === "employer" || user.role === "candidate");
  // Open source edition: video interviews only, so only those pages appear in the menu.
  const nav = openEdition
    ? fullNav.filter((item) =>
        OPEN_EDITION_PATHS[user.role as "employer" | "candidate"].some((p) => item.href === p || item.href.startsWith(`${p}/`))
      )
    : fullNav;
  const homeHref = openEdition ? OPEN_EDITION_HOME[user.role as "employer" | "candidate"] : brandHref;
  const navRef = useRef<HTMLElement>(null);
  const [compact, setCompact] = useState(false);

  // If every tab label can't fit in the nav pill, collapse inactive labels to icons.
  // Natural width is read with the compact class lifted for a moment (synchronously, so it is
  // never painted); re-checked on resize, route change and once fonts have loaded.
  useLayoutEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const update = () => {
      const had = el.classList.contains(styles.navCompact);
      if (had) el.classList.remove(styles.navCompact);
      const last = el.lastElementChild as HTMLElement | null;
      const natural = last
        ? last.getBoundingClientRect().right - el.getBoundingClientRect().left + el.scrollLeft + 9
        : 0;
      if (had) el.classList.add(styles.navCompact);
      setCompact(natural > el.clientWidth - 2);
    };
    const observer = new ResizeObserver(update);
    observer.observe(el);
    void document.fonts?.ready.then(update);
    return () => observer.disconnect();
  }, [nav, pathname]);

  function handleLogout() {
    logout();
    router.push(logoutTo);
  }

  // MAATA brand for every role: slate header with underlined tabs, white cards, blue accent.
  return (
      <div className={`${styles.page} ${styles.maata}`}>
        <header className={styles.mHeader}>
          <div className={styles.mHeaderIn}>
            <Link href={homeHref} className={styles.mLogo} aria-label="Elzuron">
              <BrandLogo />
            </Link>

            <nav aria-label="Modules" className={styles.mNav}>
              {nav.map((item) => {
                const active = isActive(pathname, item.href, nav);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`${styles.mTab} ${active ? styles.mTabOn : ""}`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className={styles.mUser}>
              {openEdition && <span className={styles.mEdition}>Open source · Video interviews</span>}
              <span className={styles.mAvatar} title={`${user.full_name} · ${roleLabel} · ${user.email}`}>
                {initialsFor(user.full_name)}
              </span>
              <span className={styles.mUserText}>
                <span className={styles.mUserName}>{user.full_name}</span>
                <span className={styles.mUserMeta}>
                  {roleLabel} · {user.email}
                </span>
              </span>
              {bell ? <NotificationCenter userId={user.id} /> : null}
              <Link href="/" className={`${styles.mBtn} ${styles.mBtnHome}`} onClick={() => setOpenEdition(false)}>
                Main Site
              </Link>
              <button type="button" className={styles.mBtn} onClick={handleLogout}>
                Log out
              </button>
            </div>
          </div>
        </header>

        <div className={styles.inner}>{children}</div>
      </div>
    );
}
