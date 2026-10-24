import type { Metadata } from "next";
import { NewCandidateForm } from "./NewCandidateForm";

export const metadata: Metadata = {
  title: "Add Candidate | Nextenti Talent Flow",
};

export default function NewCandidatePage() {
  return <NewCandidateForm />;
}
