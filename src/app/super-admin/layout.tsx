import type { ReactNode } from "react";
import { AuroraAppLayout } from "@/components/aurora/AuroraAppLayout";
import { SUPERADMIN_AURORA_NAV } from "@/components/aurora/auroraNav";

export default function SuperAdminLayout({ children }: { children: ReactNode }) {
  return (
    <AuroraAppLayout
      role="super_admin"
      nav={SUPERADMIN_AURORA_NAV}
      roleLabel="Super Admin"
      brandHref="/super-admin"
      logoutTo="/super-admin/login"
      publicPaths={["/super-admin/login"]}
    >
      {children}
    </AuroraAppLayout>
  );
}
