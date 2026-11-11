import type { Metadata } from "next";
import { EmployerApp } from "./EmployerApp";

export const metadata: Metadata = {
  title: "Employer Dashboard | Krafziel",
};

export default function EmployerPage() {
  return <EmployerApp />;
}
