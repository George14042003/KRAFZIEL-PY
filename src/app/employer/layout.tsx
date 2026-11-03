import type { ReactNode } from "react";
import { AuroraAppLayout } from "@/components/aurora/AuroraAppLayout";
import { EMPLOYER_AURORA_NAV } from "@/components/aurora/auroraNav";

export default function EmployerLayout({ children }: { children: ReactNode }) {
  return (
    <AuroraAppLayout role="employer" nav={EMPLOYER_AURORA_NAV} roleLabel="Employer" brandHref="/employer" bell>
      {children}
    </AuroraAppLayout>
  );
}
