import type { Metadata } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import { AnimatedBackground } from "@/components/background/AnimatedBackground";
import { PageTransition } from "@/components/PageTransition";
import { SecureTransportInstaller } from "@/components/SecureTransportInstaller";
import { ThemeProvider } from "@/contexts/ThemeContext";
import "./globals.css";

const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("naie_theme");
    if (stored === "light" || stored === "dark") {
      document.documentElement.setAttribute("data-theme", stored);
    }
  } catch (e) {}
})();
`;

// Display + body faces for the employer "Aurora" screens. They are bundled with the app (variable fonts, latin
// subset) instead of being fetched from Google, so a network drop can never break the page build.
const sora = localFont({
  src: "./fonts/Sora-latin.woff2",
  variable: "--font-sora",
  weight: "500 800",
  display: "swap",
});

const inter = localFont({
  src: "./fonts/Inter-latin.woff2",
  variable: "--font-inter",
  weight: "400 600",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Krafziel",
  description: "Krafziel: AI screening and live video interviews in one hiring platform.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sora.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <SecureTransportInstaller />
        <ThemeProvider>
          <AnimatedBackground />
          <PageTransition>{children}</PageTransition>
        </ThemeProvider>
        <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />
      </body>
    </html>
  );
}
