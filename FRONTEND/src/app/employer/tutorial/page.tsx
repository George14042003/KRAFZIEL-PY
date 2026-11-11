import type { Metadata } from "next";
import { TutorialClient } from "./TutorialClient";

export const metadata: Metadata = {
  title: "Tutorial | Krafziel",
};

export default function EmployerTutorialPage() {
  return <TutorialClient />;
}
