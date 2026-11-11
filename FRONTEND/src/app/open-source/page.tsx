import type { Metadata } from "next";
import { OpenSourceClient } from "./OpenSourceClient";

export const metadata: Metadata = {
  title: "Open source video interview API | Krafziel",
  description: "Krafziel's video interview rooms as a standalone API. No accounts, no database, no AI.",
};

export default function OpenSourcePage() {
  return <OpenSourceClient />;
}
