import type { ReactNode } from "react";
import { AuroraAppLayout } from "@/components/aurora/AuroraAppLayout";
import { CANDIDATE_AURORA_NAV } from "@/components/aurora/auroraNav";

export default function CandidateLayout({ children }: { children: ReactNode }) {
  return (
    <AuroraAppLayout role="candidate" nav={CANDIDATE_AURORA_NAV} roleLabel="Candidate" brandHref="/candidate">
      {children}
    </AuroraAppLayout>
  );
}
