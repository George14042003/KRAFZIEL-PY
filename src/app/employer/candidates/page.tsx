import type { Metadata } from "next";
import { CandidatePoolClient } from "./CandidatePoolClient";

export const metadata: Metadata = {
  title: "Candidate Pool | Krafziel",
};

export default function CandidatePoolPage() {
  return <CandidatePoolClient />;
}
