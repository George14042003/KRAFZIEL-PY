"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useSession } from "@/hooks/useSession";
import type { Role } from "@/lib/auth";
import { OPEN_EDITION_HOME, isAllowedInOpenEdition, useOpenEdition } from "@/lib/edition";
import { AuroraLayoutContext } from "./AuroraLayoutContext";
import { AuroraShell } from "./AuroraShell";
import type { AuroraNavItem } from "./auroraNav";
import styles from "./aurora.module.css";

function Guarded({
  role,
  nav,
  roleLabel,
  brandHref,
  logoutTo,
  bell,
  children,
}: {
  role: Role;
  nav: AuroraNavItem[];
  roleLabel: string;
  brandHref: string;
  logoutTo: string;
  bell: boolean;
  children: ReactNode;
}) {
  const { user, loading } = useSession(role);
  const pathname = usePathname();
  const router = useRouter();
  const openEdition = useOpenEdition() && (role === "employer" || role === "candidate");
  const blocked = openEdition && !isAllowedInOpenEdition(role as "employer" | "candidate", pathname);

  // Open source edition is video interviews only: anything else sends you to the interviews page.
  useEffect(() => {
    if (blocked) router.replace(OPEN_EDITION_HOME[role as "employer" | "candidate"]);
  }, [blocked, role, router]);

  if (loading || !user || blocked) {
    // Same canvas as the app, so nothing ever flashes white while the session resolves.
    return (
      <div className={`${styles.page} ${styles.maata}`}>
        <div className={styles.splash}>
          <div className={styles.spinner} />
        </div>
      </div>
    );
  }

  return (
    <AuroraShell user={user} nav={nav} roleLabel={roleLabel} brandHref={brandHref} logoutTo={logoutTo} bell={bell}>
      <AuroraLayoutContext.Provider value>{children}</AuroraLayoutContext.Provider>
    </AuroraShell>
  );
}

/** One persistent shell per area (employer / candidate / super-admin). Because it lives in a
 * Next.js layout it is NOT re-mounted when you move between tabs — only the page content swaps. */
export function AuroraAppLayout({
  role,
  nav,
  roleLabel,
  brandHref,
  logoutTo = "/login",
  bell = false,
  publicPaths = [],
  children,
}: {
  role: Role;
  nav: AuroraNavItem[];
  roleLabel: string;
  brandHref: string;
  logoutTo?: string;
  bell?: boolean;
  /** Paths inside the area that must render without the shell (e.g. a login page). */
  publicPaths?: string[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  if (publicPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return <>{children}</>;
  }
  return (
    <Guarded role={role} nav={nav} roleLabel={roleLabel} brandHref={brandHref} logoutTo={logoutTo} bell={bell}>
      {children}
    </Guarded>
  );
}
