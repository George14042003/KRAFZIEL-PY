import type { Metadata } from "next";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Forgot Password | Nextenti Talent Flow",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
