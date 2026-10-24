import type { Metadata } from "next";
import { CandidateApp } from "./CandidateApp";

export const metadata: Metadata = {
  title: "Candidate Dashboard | Nextenti Talent Flow",
};

export default function CandidatePage() {
  return <CandidateApp />;
}
