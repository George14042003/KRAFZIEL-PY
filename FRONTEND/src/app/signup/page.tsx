import type { Metadata } from "next";
import { Suspense } from "react";
import { SignupForm } from "./SignupForm";

export const metadata: Metadata = {
  title: "Sign Up | Elzuron",
  description: "Create a Elzuron Talent Flow account as a candidate or employer.",
};

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}
