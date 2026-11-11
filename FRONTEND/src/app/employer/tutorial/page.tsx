import type { Metadata } from "next";
import { TutorialClient } from "./TutorialClient";

export const metadata: Metadata = {
  title: "Tutorial | Elzuron",
};

export default function EmployerTutorialPage() {
  return <TutorialClient />;
}
