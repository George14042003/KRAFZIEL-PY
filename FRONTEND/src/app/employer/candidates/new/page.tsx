import type { Metadata } from "next";
import { NewCandidateForm } from "./NewCandidateForm";

export const metadata: Metadata = {
  title: "Add Candidate | Elzuron",
};

export default function NewCandidatePage() {
  return <NewCandidateForm />;
}
