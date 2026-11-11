import type { Metadata } from "next";
import { PricingPage } from "./PricingPage";

export const metadata: Metadata = {
  title: "Pricing | Krafziel",
  description: "Simple subscription plans for AI screening and live video interviews.",
};

export default function Pricing() {
  return <PricingPage />;
}
