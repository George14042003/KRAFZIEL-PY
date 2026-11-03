import type { Metadata } from "next";
import { AboutPage } from "@/components/about/AboutPage";

export const metadata: Metadata = {
  title: "About us | Krafziel",
  description: "Krafziel brings sourcing, AI screening and live face-to-face interviews into one room.",
};

export default function About() {
  return <AboutPage />;
}
