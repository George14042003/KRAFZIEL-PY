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

// Some browser extensions (form fillers, autofill helpers) stamp attributes such as fdprocessedid onto buttons and
// inputs before React hydrates. React then reports a hydration mismatch that has nothing to do with this app. This
// removes those foreign attributes as soon as they appear, so the server HTML and the client agree. It only watches
// for the first 20 seconds, which comfortably covers hydration.
const STRIP_EXTENSION_ATTRS_SCRIPT = `
(function () {
  try {
    var ATTR = "fdprocessedid";
    function strip(root) {
      if (root.removeAttribute) root.removeAttribute(ATTR);
      if (root.querySelectorAll) {
        var found = root.querySelectorAll("[" + ATTR + "]");
        for (var i = 0; i < found.length; i++) found[i].removeAttribute(ATTR);
      }
    }
    var observer = new MutationObserver(function (records) {
      for (var i = 0; i < records.length; i++) {
        var r = records[i];
        if (r.type === "attributes") r.target.removeAttribute(ATTR);
        for (var j = 0; j < r.addedNodes.length; j++) if (r.addedNodes[j].nodeType === 1) strip(r.addedNodes[j]);
      }
    });
    observer.observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: [ATTR] });
    document.addEventListener("DOMContentLoaded", function () { strip(document.documentElement); });
    setTimeout(function () { observer.disconnect(); }, 20000);
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
  title: "Elzuron",
  description: "Elzuron: AI screening and live video interviews in one hiring platform.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sora.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: STRIP_EXTENSION_ATTRS_SCRIPT }} />
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
