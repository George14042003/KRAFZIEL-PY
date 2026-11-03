"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fetchCurrentUser,
  getStoredToken,
  getStoredUser,
  logout,
  type AuthUser,
  type Role,
} from "@/lib/auth";

type SessionState = {
  user: AuthUser | null;
  loading: boolean;
};

/** Login URL that returns the visitor to the page they were on (same-site path only). */
function loginUrl(role: Role): string {
  const next = encodeURIComponent(window.location.pathname + window.location.search);
  const roleParam = role === "employer" || role === "candidate" ? `role=${role}&` : "";
  return `/login?${roleParam}next=${next}`;
}

export function useSession(requiredRole: Role): SessionState {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getStoredToken();
    const storedUser = getStoredUser();

    if (!token || !storedUser) {
      router.replace(loginUrl(requiredRole));
      return;
    }

    if (storedUser.role !== requiredRole) {
      const home =
        storedUser.role === "candidate"
          ? "/candidate"
          : storedUser.role === "super_admin"
            ? "/super-admin"
            : "/employer";
      router.replace(home);
      return;
    }

    setUser(storedUser);
    setLoading(false);

    fetchCurrentUser(token)
      .then((freshUser) => setUser(freshUser))
      .catch((err: { status?: number }) => {
        // Only a rejected token ends the session; network errors and 5xx keep it.
        if (err?.status !== 401 && err?.status !== 403) return;
        logout();
        router.replace(loginUrl(requiredRole));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { user, loading };
}
