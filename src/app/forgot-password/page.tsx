import type { Metadata } from "next";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Forgot Password | Krafziel",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
