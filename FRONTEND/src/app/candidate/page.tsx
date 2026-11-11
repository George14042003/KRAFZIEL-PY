import type { Metadata } from "next";
import { CandidateApp } from "./CandidateApp";

export const metadata: Metadata = {
  title: "Candidate Dashboard | Krafziel",
};

export default function CandidatePage() {
  return <CandidateApp />;
}
