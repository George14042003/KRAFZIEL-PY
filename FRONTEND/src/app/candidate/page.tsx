import type { Metadata } from "next";
import { CandidateApp } from "./CandidateApp";

export const metadata: Metadata = {
  title: "Candidate Dashboard | Elzuron",
};

export default function CandidatePage() {
  return <CandidateApp />;
}
