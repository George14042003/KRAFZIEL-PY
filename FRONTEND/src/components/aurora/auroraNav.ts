export type AuroraNavItem = {
  label: string;
  href: string;
  /** SVG path data, 24x24 viewBox, stroke only (taken from the Aurora mockups). */
  icon: string;
};

const ICON = {
  dashboard: "M3 3h7v9H3z M14 3h7v5h-7z M14 12h7v9h-7z M3 16h7v5H3z",
  jobs: "M3 8h18v12H3z M9 8V5h6v3 M3 13h18",
  people:
    "M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20 M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M20 20v-1.5a3.5 3.5 0 0 0-2.5-3.3 M15.5 4.2a3.5 3.5 0 0 1 0 6.6",
  calendar: "M4 6h16v14H4z M4 10h16 M8 3v4 M16 3v4",
  document: "M6 3h9l4 4v14H6z M15 3v4h4 M9 14l2 2 4-4",
  chart: "M4 20h17 M7 20v-6 M12 20V6 M17 20v-9",
  play: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M10 8.5l5 3.5-5 3.5z",
  settings: "M4 7h10 M18 7h2 M4 17h2 M10 17h10 M16 5v4 M8 15v4",
  scorecard: "M9 4h6v3H9z M7 5H5v16h14V5h-2 M9 14l2 2 4-4",
  user: "M20 21v-1.5a4.5 4.5 0 0 0-4.5-4.5h-7A4.5 4.5 0 0 0 4 19.5V21 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  card: "M3 6h18v12H3z M3 10h18 M7 15h3",
  mic: "M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z M5 11a7 7 0 0 0 14 0 M12 18v3 M9 21h6",
  book: "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z M4 19V5 M8 7h7 M8 11h7",
  building: "M4 21V6l8-3 8 3v15 M9 21v-5h6v5 M9 9h.01 M15 9h.01 M9 13h.01 M15 13h.01",
};

export const EMPLOYER_AURORA_NAV: AuroraNavItem[] = [
  { label: "Dashboard", href: "/employer", icon: ICON.dashboard },
  { label: "Jobs", href: "/employer/jobs", icon: ICON.jobs },
  { label: "Candidate Pool", href: "/employer/candidates", icon: ICON.people },
  { label: "Interviews", href: "/employer/interviews", icon: ICON.calendar },
  { label: "Offers", href: "/employer/offers", icon: ICON.document },
  { label: "Reports & Analytics", href: "/employer/reports", icon: ICON.chart },
  { label: "Tutorial", href: "/employer/tutorial", icon: ICON.play },
  { label: "Subscriptions", href: "/employer/billing", icon: ICON.card },
  { label: "Settings", href: "/employer/settings", icon: ICON.settings },
];

export const CANDIDATE_AURORA_NAV: AuroraNavItem[] = [
  { label: "Dashboard", href: "/candidate", icon: ICON.dashboard },
  { label: "Jobs", href: "/candidate/jobs", icon: ICON.jobs },
  { label: "My Interviews", href: "/candidate/interviews", icon: ICON.calendar },
  { label: "Scorecards", href: "/candidate/scorecards", icon: ICON.scorecard },
  { label: "Practice", href: "/candidate/mock-interviews", icon: ICON.mic },
  { label: "Articles", href: "/candidate/articles", icon: ICON.book },
  { label: "My Offers", href: "/candidate/offers", icon: ICON.document },
  { label: "Profile", href: "/candidate/profile", icon: ICON.user },
  { label: "Tutorial", href: "/#tutorial", icon: ICON.play },
  { label: "Settings", href: "/candidate/settings", icon: ICON.settings },
];

export const SUPERADMIN_AURORA_NAV: AuroraNavItem[] = [
  { label: "Organizations", href: "/super-admin", icon: ICON.building },
  { label: "Analytics", href: "/super-admin/analytics", icon: ICON.chart },
  { label: "Subscriptions", href: "/super-admin/subscriptions", icon: ICON.card },
  { label: "Settings", href: "/super-admin/settings", icon: ICON.settings },
];
