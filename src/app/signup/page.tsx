import type { Metadata } from "next";
import { SignupForm } from "./SignupForm";

export const metadata: Metadata = {
  title: "Sign Up | Nextenti Talent Flow",
  description: "Create a Nextenti Talent Flow account as a candidate or employer.",
};

export default function SignupPage() {
  return <SignupForm />;
}
