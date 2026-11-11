import type { Metadata } from "next";
import { Suspense } from "react";
import { VerifyEmailClient } from "./VerifyEmailClient";

export const metadata: Metadata = {
  title: "Confirm Email | Elzuron",
};

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailClient />
    </Suspense>
  );
}
