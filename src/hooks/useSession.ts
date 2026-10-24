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

export function useSession(requiredRole: Role): SessionState {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getStoredToken();
    const storedUser = getStoredUser();

    if (!token || !storedUser) {
      router.replace("/login");
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
      .catch(() => {
        logout();
        router.replace("/login");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { user, loading };
}
