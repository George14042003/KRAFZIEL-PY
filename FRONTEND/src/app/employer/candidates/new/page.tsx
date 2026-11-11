import type { Metadata } from "next";
import { NewCandidateForm } from "./NewCandidateForm";

export const metadata: Metadata = {
  title: "Add Candidate | Krafziel",
};

export default function NewCandidatePage() {
  return <NewCandidateForm />;
}
