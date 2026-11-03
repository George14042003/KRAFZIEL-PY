"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// The signed-in areas own persistent layouts (header stays mounted between tabs), so they
// must not be re-mounted or faded in from transparent — that is what used to flash white.
const PERSISTENT_AREAS = ["/employer", "/candidate", "/super-admin"];

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (PERSISTENT_AREAS.some((a) => pathname === a || pathname.startsWith(`${a}/`))) {
    return <>{children}</>;
  }
  return (
    <div key={pathname} className="fade-in">
      {children}
    </div>
  );
}
