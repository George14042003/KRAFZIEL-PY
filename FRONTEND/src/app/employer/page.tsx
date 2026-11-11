import type { Metadata } from "next";
import { EmployerApp } from "./EmployerApp";

export const metadata: Metadata = {
  title: "Employer Dashboard | Elzuron",
};

export default function EmployerPage() {
  return <EmployerApp />;
}
