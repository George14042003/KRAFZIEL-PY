"use client";

import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { LoopingVideo } from "@/components/LoopingVideo";
import { Reveal } from "@/components/homepage/Reveal";
import { PricingPlans } from "@/components/pricing/PricingPlans";
import styles from "./HomePage.module.css";

function Svg({ children, size = 18, sw = 1.8 }: { children: ReactNode; size?: number; sw?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

const UserIcon = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
  </Svg>
);
const BriefcaseIcon = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18" />
  </Svg>
);
const CheckIcon = ({ size = 14 }: { size?: number }) => (
  <Svg size={size} sw={2.6}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Svg>
);
const ArrowIcon = () => (
  <Svg>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);

const LOGIN_CANDIDATE = "/login?role=candidate";
const LOGIN_EMPLOYER = "/login?role=employer";
const OPEN_SOURCE_URL = "/open-source";
const SEARCH_JOBS_URL = "https://nextenti.ai/search-jobs";

const FEATURES: { title: string; body: string; icon: ReactNode }[] = [
  {
    title: "AI screening interviews",
    body: "A bot-led first round screens every applicant consistently, so recruiters only spend time on people who are worth meeting.",
    icon: (
      <>
        <rect x="4" y="7" width="16" height="12" rx="3" />
        <path d="M12 7V4M9 12h.01M15 12h.01M9.5 15.5h5" />
      </>
    ),
  },
  {
    title: "Real face-to-face interviews",
    body: "Shortlisted candidates move straight into a live video room with the hiring team, scheduled and tracked from one calendar.",
    icon: (
      <>
        <rect x="3" y="6" width="13" height="12" rx="2.5" />
        <path d="M16 10l5-3v10l-5-3" />
      </>
    ),
  },
  {
    title: "Sourcing in one place",
    body: "Pull candidates from job boards, referrals and your ATS into one shared pool, searchable by role or location.",
    icon: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.3-4.3" />
      </>
    ),
  },
  {
    title: "Candidate pool & pipeline",
    body: "Every candidate by status, from pending review to hired, moved forward with one click.",
    icon: (
      <>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M16 4.7a3.5 3.5 0 0 1 0 6.6M18 14.3c2.2.7 3.5 2.7 3.5 5.7" />
      </>
    ),
  },
  {
    title: "Reports & analytics",
    body: "Track interviews by type, source quality and offer acceptance so you can see what is actually working.",
    icon: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  },
];

const STEPS = [
  { title: "Post the role", body: "Create a job in minutes and let candidates find it, or pull in people already in your pool." },
  { title: "Stage 1 · AI screening", body: "Each applicant completes an AI-led interview. You get a structured, comparable summary." },
  { title: "Stage 2 · Live interview", body: "Top candidates meet your team face to face in a single room, with notes and scoring built in." },
  { title: "Decide and hire", body: "Review the full picture, send the offer and track acceptance without leaving the platform." },
];

const NAV = [
  { href: "/about", label: "About us" },
  { href: "#features", label: "Features" },
  { href: "#how", label: "How It Works" },
  { href: "#tutorial", label: "Tutorial" },
  { href: "#who", label: "Who It’s For" },
  { href: "#pricing", label: "Pricing" },
];

/** Krafziel logo (Krafziel) on a white plate so it reads on the dark header and footer. */
function Logo({ height }: { height?: number }) {
  return (
    <Link href="/" className={styles.logo} aria-label="Krafziel">
      <BrandLogo height={height} />
    </Link>
  );
}

function CheckList({ items }: { items: string[] }) {
  return (
    <ul className={styles.checks}>
      {items.map((t) => (
        <li key={t}>
          <span className={styles.tick}>
            <CheckIcon />
          </span>
          {t}
        </li>
      ))}
    </ul>
  );
}

export function HomePage() {
  const tutorialVideo = useRef<HTMLVideoElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeId, setActiveId] = useState<string>("");
  const [scrolled, setScrolled] = useState(false);

  // Header: highlight the section being viewed, and add a shadow once the page has scrolled.
  useEffect(() => {
    const ids = NAV.filter((n) => n.href.startsWith("#")).map((n) => n.href.slice(1));
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).sort((x, y) => y.intersectionRatio - x.intersectionRatio)[0];
        if (hit) setActiveId(hit.target.id);
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    });
    const onScroll = () => {
      setScrolled(window.scrollY > 8);
      if (window.scrollY < 120) setActiveId("");
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  // Close the mobile menu on Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const [playing, setPlaying] = useState(false);

  function playTutorial() {
    setPlaying(true);
    void tutorialVideo.current?.play();
  }

  return (
    <div className={styles.page}>
      <header className={`${styles.header} ${scrolled ? styles.headerScrolled : ""}`}>
        <div className={styles.hdr}>
          <Logo />

          <nav aria-label="Main" className={styles.hdrNav}>
            {NAV.map((n) => {
              const on = n.href === `#${activeId}`;
              return (
                <a key={n.href} href={n.href} className={`${styles.hdrLink} ${on ? styles.hdrLinkOn : ""}`} aria-current={on ? "true" : undefined}>
                  {n.label}
                </a>
              );
            })}
          </nav>

          <div className={styles.hdrActions}>
            <Link href={LOGIN_CANDIDATE} className={styles.hdrLogin}>
              Log in
            </Link>
            <Link href={OPEN_SOURCE_URL} className={styles.hdrOpen}>
              <Svg size={16}>
                <path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16" />
              </Svg>
              <span>Open source</span>
            </Link>
            <Link href={LOGIN_CANDIDATE} className={styles.hdrCandidate}>
              <UserIcon size={16} />
              <span>Candidate</span>
            </Link>
            <Link href={LOGIN_EMPLOYER} className={styles.hdrEmployer}>
              <BriefcaseIcon size={16} />
              Employer
            </Link>
            <button
              type="button"
              className={styles.hdrBurger}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <Svg size={22}>{menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}</Svg>
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className={styles.hdrMenu}>
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className={styles.hdrMenuLink} onClick={() => setMenuOpen(false)}>
                {n.label}
              </a>
            ))}
            <div className={styles.hdrMenuBtns}>
              <Link href={LOGIN_CANDIDATE} className={`${styles.bt} ${styles.btGhost}`} onClick={() => setMenuOpen(false)}>
                <UserIcon />
                Candidate
              </Link>
              <Link href={OPEN_SOURCE_URL} className={`${styles.bt} ${styles.btGhost} ${styles.openBtn}`} onClick={() => setMenuOpen(false)}>
                Open source
              </Link>
              <Link href={LOGIN_EMPLOYER} className={`${styles.bt} ${styles.bp}`} onClick={() => setMenuOpen(false)}>
                <BriefcaseIcon />
                Employer
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroVideoBg} aria-hidden="true">
          <LoopingVideo src="/videos/hero-bg.mp4" className={styles.heroVideo} />
        </div>
        <div className={styles.glowA} aria-hidden="true" />
        <div className={styles.glowB} aria-hidden="true" />
        <div className={styles.grid} aria-hidden="true" />
        <div className={`${styles.wrap} ${styles.heroIn}`}>
          <span className={styles.pill}>
            <i />
            AI-Powered · Two-Stage Interview Workflow
          </span>
          <h1 className={styles.h1}>
            Where great hires actually happen <span className={styles.grad}>live.</span>
          </h1>
          <p className={styles.lede}>
            Krafziel Talent Flow brings sourcing, AI screening, and real, face-to-face interviews into a single room — so every hiring
            decision is made on a real conversation, not just a resume.
          </p>
          <div className={styles.heroCtas}>
            <Link href={LOGIN_CANDIDATE} className={`${styles.bt} ${styles.bp} ${styles.btLg}`}>
              <UserIcon size={20} />
              I’m a Candidate
            </Link>
            <Link href={LOGIN_EMPLOYER} className={`${styles.bt} ${styles.btLg} ${styles.btOutline}`}>
              <BriefcaseIcon size={20} />
              I’m an Employer
            </Link>
            <a href="#tutorial" className={styles.watch}>
              <span className={styles.playDot}>
                <Svg>
                  <path d="M8 5v14l11-7z" fill="currentColor" />
                </Svg>
              </span>
              Watch how it works
            </a>
          </div>

          <a href={SEARCH_JOBS_URL} className={`${styles.bt} ${styles.bp} ${styles.btLg} ${styles.heroSearchBtn}`}>
            <Svg size={20}>
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </Svg>
            Search for jobs
          </a>
        </div>
      </section>

      {/* Features */}
      <section id="features" className={`${styles.screen} ${styles.screenFeatures}`}>
        <div className={`${styles.wrap} ${styles.featuresLayout}`}>
          <Reveal>
            <div className={styles.featuresIntro}>
              <div className={styles.kk}>Features</div>
              <h2 className={styles.h2}>Everything hiring needs, in one room</h2>
              <p className={styles.sub}>
                From the first search to the signed offer, every step lives in one place so nothing falls through the gaps.
              </p>
              <p className={styles.featuresNote}>
                No more switching between a job board, a spreadsheet, a video tool and an inbox. Your team sources, screens, interviews and
                decides in a single workflow, and every candidate keeps one complete record from first contact to offer.
              </p>
              <div className={styles.featuresCtas}>
                <Link href={LOGIN_EMPLOYER} className={`${styles.bt} ${styles.bp}`}>
                  Start hiring
                  <ArrowIcon />
                </Link>
                <a href="#pricing" className={styles.bt}>
                  See pricing
                </a>
              </div>
            </div>
          </Reveal>
          <ul className={styles.featureList}>
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delayMs={i * 50}>
                <li className={styles.featureRow}>
                  <span className={styles.featureIcon}>
                    <Svg size={24}>{f.icon}</Svg>
                  </span>
                  <div>
                    <h3 className={styles.h3}>{f.title}</h3>
                    <p className={styles.body}>{f.body}</p>
                  </div>
                </li>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className={`${styles.screen} ${styles.how}`}>
        <div className={styles.howGlow} aria-hidden="true" />
        <div className={`${styles.wrap} ${styles.howIn}`}>
          <div className={`${styles.kk} ${styles.kkLight}`}>How it works</div>
          <h2 className={`${styles.h2} ${styles.h2Light}`}>A two-stage interview workflow that respects everyone’s time</h2>
          <div className={styles.steps}>
            {STEPS.map((s, i) => (
              <Reveal key={s.title} delayMs={i * 80}>
                <div className={styles.step}>
                  <div className={styles.stepTop}>
                    <span className={styles.stepNum}>{i + 1}</span>
                    {i < STEPS.length - 1 && <i className={styles.stepLine} />}
                  </div>
                  <h3 className={`${styles.h3} ${styles.h3Light}`}>{s.title}</h3>
                  <p className={styles.stepBody}>{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Tutorial */}
      <section id="tutorial" className={`${styles.screen} ${styles.screenTutorial}`}>
        <div className={`${styles.wrap} ${styles.tutorial}`}>
        <Reveal>
          <div>
            <div className={styles.kk}>Tutorial</div>
            <h2 className={styles.h2}>See it in action in a few minutes</h2>
            <p className={styles.sub}>
              Walk through posting a role, running an AI screening, and hosting a live interview. The tutorial also lives inside the app,
              ready whenever your team needs it.
            </p>
            <CheckList items={["Post a job and review applicants", "Run Stage 1 and Stage 2 interviews", "Send offers and track acceptance"]} />
          </div>
        </Reveal>
        <Reveal delayMs={80}>
          <div className={styles.tutorialMedia}>
            <video
              ref={tutorialVideo}
              className={styles.tutorialVideo}
              playsInline
              preload="metadata"
              controls={playing}
              aria-label="Explainer video: how the interview engine works"
            >
              <source src="/videos/ai_interview_engine_explainer.mp4" type="video/mp4" />
            </video>
            {!playing && (
              <>
                <div className={styles.tutorialGlow} aria-hidden="true" />
                <button type="button" className={styles.bigPlay} onClick={playTutorial} aria-label="Play the tutorial video">
                  <Svg size={34}>
                    <path d="M8 5v14l11-7z" fill="currentColor" />
                  </Svg>
                </button>
              </>
            )}
          </div>
        </Reveal>
        </div>
      </section>

      {/* Who it's for */}
      <section id="who" className={`${styles.screen} ${styles.screenWho}`}>
        <div className={styles.wrap}>
        <Reveal>
          <div className={styles.head}>
            <div className={styles.kk}>Who it’s for</div>
            <h2 className={styles.h2}>Built for both sides of the table</h2>
          </div>
        </Reveal>
        <div className={styles.grid2}>
          <Reveal>
            <div className={`${styles.card} ${styles.audience}`}>
              <span className={styles.audienceIcon}>
                <UserIcon size={28} />
              </span>
              <div>
                <div className={styles.kk}>Candidates</div>
                <h3 className={styles.h3Big}>Be heard, not just scanned</h3>
              </div>
              <CheckList
                items={[
                  "Find open roles by title, department or location",
                  "Interview on your own time with the AI screen",
                  "Meet the hiring team face to face when you advance",
                ]}
              />
              <Link href={LOGIN_CANDIDATE} className={`${styles.bt} ${styles.audienceBtn}`}>
                I’m a Candidate
                <ArrowIcon />
              </Link>
            </div>
          </Reveal>
          <Reveal delayMs={80}>
            <div className={`${styles.card} ${styles.audience}`}>
              <span className={styles.audienceIcon}>
                <BriefcaseIcon size={28} />
              </span>
              <div>
                <div className={styles.kk}>Employers</div>
                <h3 className={styles.h3Big}>Hire on real conversations</h3>
              </div>
              <CheckList
                items={[
                  "Source, screen and interview in one platform",
                  "See every candidate and stage in a single pipeline",
                  "Make decisions with notes, scores and analytics",
                ]}
              />
              <Link href={LOGIN_EMPLOYER} className={`${styles.bt} ${styles.bp} ${styles.audienceBtn}`}>
                I’m an Employer
                <ArrowIcon />
              </Link>
            </div>
          </Reveal>
        </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className={`${styles.screen} ${styles.screenPricing}`}>
        <div className={styles.wrap}>
        <Reveal>
          <div className={styles.head}>
            <div className={styles.kk}>Pricing</div>
            <h2 className={styles.h2}>Plans that grow with your hiring</h2>
          </div>
        </Reveal>
        <div className={styles.planGrid}>
          <PricingPlans variant="home" />
        </div>
        </div>
      </section>

      {/* CTA */}
      <section className={`${styles.wrap} ${styles.ctaWrap}`}>
        <div className={styles.cta}>
          <div className={styles.ctaGlowA} aria-hidden="true" />
          <div className={styles.ctaGlowB} aria-hidden="true" />
          <div style={{ position: "relative" }}>
            <h2 className={`${styles.h2} ${styles.h2Light}`}>
              Ready to hire on <span className={styles.grad}>real conversations?</span>
            </h2>
            <p className={styles.ctaSub}>Join the teams moving sourcing, screening and live interviews into a single room.</p>
            <div className={styles.ctaBtns}>
              <Link href={LOGIN_EMPLOYER} className={`${styles.bt} ${styles.bp} ${styles.btLg}`}>
                I’m an Employer
              </Link>
              <Link href={LOGIN_CANDIDATE} className={`${styles.bt} ${styles.btLg}`}>
                I’m a Candidate
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={`${styles.wrap} ${styles.footerTop}`}>
          <Logo height={50} />
          <nav className={styles.footerNav} aria-label="Footer">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className={styles.tn}>
                {n.label}
              </a>
            ))}
          </nav>
        </div>
        <div className={`${styles.wrap} ${styles.footerBottom}`}>
          <span>© {new Date().getFullYear()} Krafziel. All rights reserved.</span>
          <span className={styles.footerLinks}>
            <Link href="/about">About us</Link>
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/terms">Terms of Use</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
