import type { Metadata } from "next";
import { SuperAdminLoginForm } from "./SuperAdminLoginForm";

export const metadata: Metadata = {
  title: "Admin Sign In | Krafziel",
};

export default function SuperAdminLoginPage() {
  return <SuperAdminLoginForm />;
}
