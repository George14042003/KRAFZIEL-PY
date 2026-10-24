"use client";

import Link from "next/link";
import { Logo } from "@/components/Logo";
import { BriefcaseIcon, SparklesIcon, UserIcon } from "@/components/auth/icons";
import { AnimatedStats } from "@/components/homepage/AnimatedStats";
import { MarqueeTicker } from "@/components/homepage/MarqueeTicker";
import { PipelineDemo } from "@/components/homepage/PipelineDemo";
import { Reveal } from "@/components/homepage/Reveal";
import { ScrollProgressBar } from "@/components/homepage/ScrollProgressBar";
import { ThemeToggle } from "@/components/ThemeToggle";
import styles from "./HomePage.module.css";

function SearchIcon({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx={11} cy={11} r={7} />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

function PlayIcon({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none">
      <path d="M8 5.5v13l11-6.5-11-6.5Z" />
    </svg>
  );
}

function ChevronDownIcon({ size = 20, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function VideoIcon({ size = 14, color = "#fff" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="14" height="12" rx="2" />
      <path d="M16 10.5l6-3.5v10l-6-3.5" />
    </svg>
  );
}

function PipelineIcon({ size = 14, color = "#fff" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5" cy="12" r="2.5" />
      <circle cx="19" cy="6" r="2.5" />
      <circle cx="19" cy="18" r="2.5" />
      <path d="M7.3 11l9.4-3.7M7.3 13l9.4 3.7" />
    </svg>
  );
}

function CheckIcon({ size = 14, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function TeamPipelineIllustration({ className }: { className?: string }) {
  const stages = [
    { label: "Sourced", x: 30 },
    { label: "Screened", x: 150 },
    { label: "Interview", x: 270 },
    { label: "Offer", x: 390 },
  ];
  return (
    <svg viewBox="0 0 500 320" preserveAspectRatio="xMidYMid slice" className={className} role="img" aria-label="Shared candidate pipeline across every stage of hiring">
      <defs>
        <linearGradient id="pipelineCard" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0891b2" />
          <stop offset="100%" stopColor="#01617a" />
        </linearGradient>
        <linearGradient id="pipelineAvatar" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>
      </defs>
      <rect width="500" height="320" fill="#0f172a" />

      {stages.map((s) => (
        <g key={s.label}>
          <text x={s.x} y="34" fontSize="11" fontWeight="800" letterSpacing="0.04em" fill="#7dd3fc">
            {s.label.toUpperCase()}
          </text>
          <rect x={s.x} y="50" width="80" height="3" rx="1.5" fill="#0891b2" fillOpacity="0.4" />
        </g>
      ))}

      {[
        { x: 30, y: 72, filled: true },
        { x: 30, y: 152, filled: true },
        { x: 150, y: 72, filled: true },
        { x: 270, y: 72, filled: true },
        { x: 270, y: 152, filled: false },
        { x: 390, y: 72, filled: false },
      ].map((c, i) => (
        <g key={i} opacity={c.filled ? 1 : 0.45}>
          <rect x={c.x} y={c.y} width="80" height="62" rx="10" fill="url(#pipelineCard)" fillOpacity="0.9" />
          <circle cx={c.x + 20} cy={c.y + 22} r="10" fill="url(#pipelineAvatar)" />
          <rect x={c.x + 36} y={c.y + 16} width="34" height="5" rx="2.5" fill="#e0f2fe" fillOpacity="0.85" />
          <rect x={c.x + 36} y={c.y + 26} width="24" height="5" rx="2.5" fill="#e0f2fe" fillOpacity="0.55" />
          <rect x={c.x + 12} y={c.y + 42} width="56" height="5" rx="2.5" fill="#e0f2fe" fillOpacity="0.35" />
        </g>
      ))}

      <path d="M118 100h20" stroke="#0891b2" strokeWidth={2} strokeDasharray="3 4" />
      <path d="M238 100h20" stroke="#0891b2" strokeWidth={2} strokeDasharray="3 4" />
      <path d="M358 100h20" stroke="#0891b2" strokeWidth={2} strokeDasharray="3 4" />

      <g transform="translate(30, 240)">
        <circle cx="0" cy="0" r="16" fill="url(#pipelineAvatar)" stroke="#0f172a" strokeWidth={3} />
        <circle cx="22" cy="0" r="16" fill="url(#pipelineCard)" stroke="#0f172a" strokeWidth={3} />
        <circle cx="44" cy="0" r="16" fill="url(#pipelineAvatar)" stroke="#0f172a" strokeWidth={3} />
        <text x="72" y="5" fontSize="13" fontWeight="700" fill="#fff">Same pipeline, every recruiter</text>
      </g>
    </svg>
  );
}

function SourcePoolIllustration({ className }: { className?: string }) {
  const sources = [
    { label: "ATS", x: 40, color: "#0891b2" },
    { label: "LinkedIn", x: 155, color: "#01617a" },
    { label: "Referral", x: 270, color: "#018452" },
    { label: "Job Post", x: 355, color: "#10b981" },
  ];
  return (
    <svg viewBox="0 0 400 200" preserveAspectRatio="xMidYMid meet" className={className} role="img" aria-label="Candidates sourced from an ATS, LinkedIn, referrals, and job postings into one shared pool">
      <defs>
        <linearGradient id="sourcePoolAvatarA" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>
        <linearGradient id="sourcePoolAvatarB" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0891b2" />
          <stop offset="100%" stopColor="#01617a" />
        </linearGradient>
        <linearGradient id="sourcePoolAvatarC" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0a275f" />
          <stop offset="100%" stopColor="#071a3d" />
        </linearGradient>
      </defs>

      {sources.map((s) => (
        <g key={s.label}>
          <rect x={s.x - 30} y="14" width="60" height="26" rx="13" fill={s.color} fillOpacity="0.18" stroke={s.color} strokeOpacity="0.5" />
          <text x={s.x} y="31" textAnchor="middle" fontSize="10" fontWeight="700" fill={s.color}>
            {s.label}
          </text>
          <path d={`M${s.x} 40 C ${s.x} 90, 200 90, 200 118`} stroke={s.color} strokeOpacity="0.4" strokeWidth={1.6} strokeDasharray="3 4" fill="none" />
        </g>
      ))}

      <rect x="110" y="118" width="180" height="66" rx="20" fill="#0891b2" fillOpacity="0.12" stroke="#0891b2" strokeOpacity="0.35" />
      <circle cx="165" cy="151" r="18" fill="url(#sourcePoolAvatarA)" stroke="#0f172a" strokeOpacity="0.4" strokeWidth={2} />
      <circle cx="196" cy="151" r="18" fill="url(#sourcePoolAvatarB)" stroke="#0f172a" strokeOpacity="0.4" strokeWidth={2} />
      <circle cx="227" cy="151" r="18" fill="url(#sourcePoolAvatarC)" stroke="#0f172a" strokeOpacity="0.4" strokeWidth={2} />
      <text x="200" y="180" textAnchor="middle" fontSize="11" fontWeight="700" fill="#0e7490">
        One shared pool
      </text>
    </svg>
  );
}

function JobsTrackingIllustration({ className }: { className?: string }) {
  const rows = [
    { pct: 82, color: "#10b981" },
    { pct: 58, color: "#f59e0b" },
    { pct: 71, color: "#10b981" },
    { pct: 40, color: "#94a3b8" },
  ];
  return (
    <svg viewBox="0 0 500 320" preserveAspectRatio="xMidYMid slice" className={className} role="img" aria-label="Job posting with an AI-ranked shortlist of candidates">
      <defs>
        <linearGradient id="jobsAvatar" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0a275f" />
          <stop offset="100%" stopColor="#071a3d" />
        </linearGradient>
      </defs>
      <rect width="500" height="320" fill="#0f172a" />

      <rect x="24" y="24" width="452" height="56" rx="12" fill="#0a275f" fillOpacity="0.6" stroke="#1e293b" />
      <text x="44" y="50" fontSize="16" fontWeight="800" fill="#fff">Product Manager</text>
      <text x="44" y="68" fontSize="11" fill="#94a3b8">Hyderabad, India · Full Time</text>
      <rect x="392" y="38" width="60" height="26" rx="13" fill="#10b981" fillOpacity="0.18" stroke="#10b981" strokeOpacity="0.5" />
      <text x="422" y="55" textAnchor="middle" fontSize="10.5" fontWeight="800" fill="#6ee7c2">
        ACTIVE
      </text>

      {rows.map((r, i) => {
        const y = 104 + i * 48;
        return (
          <g key={i}>
            <rect x="24" y={y} width="452" height="38" rx="10" fill="#111c33" />
            <circle cx="48" cy={y + 19} r="13" fill="url(#jobsAvatar)" />
            <rect x="70" y={y + 10} width="90" height="6" rx="3" fill="#cbd5e1" fillOpacity="0.8" />
            <rect x="70" y={y + 22} width="60" height="5" rx="2.5" fill="#64748b" />
            <rect x="330" y={y + 13} width="110" height="10" rx="5" fill="#1e293b" />
            <rect x="330" y={y + 13} width={110 * (r.pct / 100)} height="10" rx="5" fill={r.color} />
          </g>
        );
      })}
    </svg>
  );
}

const STEPS = [
  {
    title: "Source & add candidates",
    desc: "Bring candidates in from anywhere — your ATS, LinkedIn, referrals, or your own job postings — into one shared pool your whole team can see.",
    photo: "/homepage/interview-desk.jpg?v=5",
  },
  {
    title: "AI pre-screens automatically",
    desc: "Every candidate gets a fast, consistent first-round interview from the Nextenti bot — no recruiter time spent on early screening.",
    photo: undefined as string | undefined,
  },
  {
    title: "Meet live, decide with confidence",
    desc: "Move straight into a real video interview inside Nextenti, and make the call based on an actual conversation.",
    photo: undefined as string | undefined,
  },
];

function RocketIcon({ size = 20, color = "#fff" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2c3 1.5 5 4.5 5 8.5 0 3-1 5.5-2.5 7.5h-5C8 16 7 13.5 7 10.5 7 6.5 9 3.5 12 2Z" />
      <circle cx="12" cy="9" r="2" />
      <path d="M9 17.5 7 21M15 17.5l2 3.5" />
    </svg>
  );
}

function BuildingIcon({ size = 20, color = "#fff" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3" width="10" height="18" rx="1" />
      <rect x="14" y="9" width="6" height="12" rx="1" />
      <path d="M7 7h1M10 7h1M7 11h1M10 11h1M7 15h1M10 15h1" />
    </svg>
  );
}

function StaffIcon({ size = 20, color = "#fff" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5" />
      <circle cx="17.5" cy="8.5" r="2.2" />
      <path d="M15.5 13.5c2.3.4 4 2.3 4 4.7" />
    </svg>
  );
}

function HeartPulseIcon({ size = 20, color = "#fff" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20.5S3.5 15 3.5 9a4.5 4.5 0 0 1 8.5-2 4.5 4.5 0 0 1 8.5 2c0 6-8.5 11.5-8.5 11.5Z" />
      <path d="M6.5 10h2l1.5-3 2 6 1.5-3h4" />
    </svg>
  );
}

function LaptopIcon({ size = 20, color = "#fff" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="11" rx="1.5" />
      <path d="M2 19h20M9 8l-2 2.5L9 13M15 8l2 2.5L15 13" />
    </svg>
  );
}

const USP_STRIP = [
  { icon: SparklesIcon, color: "#0e5266", label: "AI + live, two-stage interviews" },
  { icon: VideoIcon, color: "#0a275f", label: "Built-in video, zero setup" },
  { icon: PipelineIcon, color: "#0f6b5c", label: "One shared pipeline, every recruiter" },
  { icon: BriefcaseIcon, color: "#334155", label: "Job postings candidates can apply to" },
];

const BUILT_FOR = [
  { icon: RocketIcon, color: "#0e5266", label: "Fast-growing startups" },
  { icon: BuildingIcon, color: "#0a275f", label: "Enterprise hiring teams" },
  { icon: StaffIcon, color: "#334155", label: "Staffing agencies" },
  { icon: HeartPulseIcon, color: "#1e3a5f", label: "Healthcare & life sciences" },
  { icon: LaptopIcon, color: "#0f6b5c", label: "Tech & engineering teams" },
];

const FEATURES = [
  {
    tag: "AI screening",
    tagColor: "emerald" as const,
    title: "Two-stage interviews, start to finish",
    desc: "Every candidate starts with an automated AI screening, then moves straight into a live, face-to-face round — no scheduling back-and-forth, no lost momentum.",
    bullets: ["Automated first-round screening", "Consistent questions for every candidate", "Live round only for strong fits"],
    photo: "/homepage/interview-panel.jpg?v=6",
    alt: "Candidate being interviewed by a hiring panel",
  },
  {
    tag: "Team pipeline",
    tagColor: "blue" as const,
    title: "One shared pool, sourced from anywhere",
    desc: "Every recruiter on your team sees the same live pipeline — candidates sourced from your ATS, LinkedIn, referrals, or your own job postings all land in one place.",
    bullets: ["Real-time video calls, no third-party app", "Every recruiter sees the same pipeline", "Group interviews supported natively"],
    photo: "/homepage/group-call.webp?v=2",
    alt: "Team reviewing a shared candidate pipeline sourced from LinkedIn, referrals, job postings, and other channels",
  },
  {
    tag: "Jobs & tracking",
    tagColor: "navy" as const,
    title: "Job postings your candidates can actually apply to",
    desc: "Publish requisitions candidates can browse and apply to directly, and see every applicant ranked and tracked end to end — from application to offer.",
    bullets: ["Public job postings, direct applications", "AI-ranked candidate shortlists", "Tracked from application to offer"],
    photo: "/homepage/ai-screening.webp?v=2",
    alt: "Open job postings and an applicant tracking dashboard with AI-ranked candidates",
  },
];

export function HomePage() {
  return (
    <div className={styles.page}>
      <ScrollProgressBar />
      <nav className={styles.nav}>
        <div className={styles.navBrand}>
          <Logo size={40} radius={11} />
          <div className={styles.navBrandLockup}>
            <span className={styles.navBrandName}>Nextenti</span>
            <span className={styles.navBrandTagline}>Talent Flow</span>
          </div>
        </div>
        <div className={styles.navLinks}>
          <a href="#features" className={styles.navLink}>Features</a>
          <a href="#how-it-works" className={styles.navLink}>How It Works</a>
          <a href="#tutorial" className={styles.navLink}>Tutorial</a>
          <a href="#built-for" className={styles.navLink}>Who It&apos;s For</a>
        </div>
        <div className={styles.navActions}>
          <span className={styles.navThemeToggleWrap}>
            <ThemeToggle size={34} variant="ghost" iconColor="#fff" />
          </span>
          <Link href="/login?role=candidate" className={styles.navLoginLink}>
            Log in
          </Link>
          <Link href="/login?role=candidate" className={`${styles.navBtn} ${styles.navBtnCandidate}`}>
            <UserIcon size={14} color="#fff" />
            Candidate
          </Link>
          <Link href="/login?role=employer" className={`${styles.navBtn} ${styles.navBtnEmployer}`}>
            <BriefcaseIcon size={14} color="#fff" />
            Employer
          </Link>
        </div>
      </nav>

      <header className={styles.hero}>
        <div className={styles.heroVideoBg} aria-hidden="true">
          <video className={styles.heroVideo} autoPlay muted loop playsInline preload="auto">
            <source src="/videos/hero-bg.mp4" type="video/mp4" />
          </video>
          <div className={styles.heroVideoOverlay} />
        </div>

        <div className={styles.heroContent}>
          <span className={styles.eyebrow}>
            <SparklesIcon size={12} color="#bcd7f5" />
            AI-Powered · Two-Stage Interview Workflow
          </span>

          <h1 className={styles.headline}>
            Where great hires
            <span className={styles.headlineAccent}>actually happen live.</span>
          </h1>

          <p className={styles.subhead}>
            Nextenti Talent Flow brings sourcing, AI screening, and real, face-to-face interviews
            into a single room — so every hiring decision is made on a real conversation, not just
            a resume.
          </p>

          <div className={styles.heroCtas}>
            <Link href="/login?role=candidate" className={styles.ctaPrimary}>
              <UserIcon size={15} color="#fff" />
              I&apos;m a Candidate
            </Link>
            <Link href="/login?role=employer" className={styles.ctaSecondary}>
              <BriefcaseIcon size={15} color="#fff" />
              I&apos;m an Employer
            </Link>
            <a href="#how-it-works" className={styles.heroWatchLink}>
              <span className={styles.heroWatchIcon}>
                <PlayIcon size={11} color="#0a275f" />
              </span>
              Watch how it works
            </a>
          </div>

          <form
            className={styles.heroSearch}
            onSubmit={(e) => {
              e.preventDefault();
              window.location.href = "/login?role=candidate";
            }}
          >
            <SearchIcon size={15} color="rgba(255,255,255,0.6)" />
            <input type="text" placeholder="Search open roles by title, department, or location…" />
            <button type="submit">Search</button>
          </form>
        </div>

        <a href="#features" className={styles.heroScrollHint} aria-label="Scroll to features">
          <ChevronDownIcon size={20} color="#fff" />
        </a>
      </header>

      <div className={styles.uspStrip}>
        {USP_STRIP.map((u) => {
          const Icon = u.icon;
          return (
            <span key={u.label} className={styles.uspItem}>
              <span className={styles.uspIcon} style={{ background: u.color }}>
                <Icon size={14} color="#fff" />
              </span>
              {u.label}
            </span>
          );
        })}
      </div>

      <MarqueeTicker />

      <section className={styles.section} style={{ paddingTop: "40px", paddingBottom: "40px" }}>
        <AnimatedStats />
      </section>

      <section id="features" className={styles.section}>
        <Reveal>
          <span className={styles.sectionLabel}>Why Nextenti</span>
          <h2 className={styles.sectionTitle}>Everything hiring needs, none of the third-party tools.</h2>
        </Reveal>

        <div className={styles.showcaseGridNew}>
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delayMs={i * 100} className={styles.showcaseCardNew}>
              <div className={styles.browserFrame}>
                <div className={styles.browserChrome}>
                  <span className={styles.browserDot} style={{ background: "#ef4444" }} />
                  <span className={styles.browserDot} style={{ background: "#f59e0b" }} />
                  <span className={styles.browserDot} style={{ background: "#10b981" }} />
                  <span className={styles.browserUrl}>app.nextenti.com</span>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.photo} alt={f.alt} className={styles.browserPhoto} />
              </div>
              <span className={`${styles.featureTag} ${styles[`tag_${f.tagColor}`]}`}>{f.tag}</span>
              <h3 className={styles.showcaseCardTitle}>{f.title}</h3>
              <p className={styles.showcaseCardDesc}>{f.desc}</p>
              <ul className={styles.featureBullets}>
                {f.bullets.slice(0, 2).map((b) => (
                  <li key={b}>
                    <CheckIcon size={13} color="currentColor" />
                    {b}
                  </li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="how-it-works" className={styles.section}>
        <span className={styles.sectionLabel}>How it works</span>
        <h2 className={styles.sectionTitle}>From sourced to hired, in three steps.</h2>

        <div className={styles.stepsVideoWrap}>
          <video
            className={styles.stepsOverviewImg}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            aria-label="Animation of the three-step hiring process: source and add candidates into one shared pool, AI pre-screens automatically, then meet live and decide with confidence"
          >
            <source src="/videos/hiring-flow-animation.mp4" type="video/mp4" />
          </video>
        </div>

        <div className={styles.steps}>
          {STEPS.map((s, i) => (
            <div key={s.title} className={styles.step}>
              <h3 className={styles.stepTitle}>
                <span className={styles.stepTitleNumber}>{i + 1}.</span> {s.title}
              </h3>
              <p className={styles.stepDesc}>{s.desc}</p>
            </div>
          ))}
        </div>

        <Reveal delayMs={100} style={{ marginTop: "48px" }}>
          <PipelineDemo />
        </Reveal>
      </section>

      <section id="tutorial" className={styles.section}>
        <span className={styles.sectionLabel}>Tutorial</span>
        <h2 className={styles.sectionTitle}>See the AI interview engine in action.</h2>
        <p className={styles.tutorialSubtext}>
          A walkthrough of how candidates are questioned, evaluated, and guided through the NAIE interview engine — start to finish.
        </p>

        <div className={styles.explainerVideoWrap}>
          <video
            suppressHydrationWarning
            className={styles.explainerVideoImg}
            autoPlay
            muted
            loop
            playsInline
            controls
            preload="auto"
            aria-label="Explainer video walking through how the NAIE AI interview engine works, from resume-based questions to soft-skill evaluation"
          >
            <source src="/videos/ai_interview_engine_explainer.mp4" type="video/mp4" />
          </video>
        </div>
      </section>

      <section id="built-for" className={styles.section}>
        <span className={styles.sectionLabel}>Who it&apos;s for</span>
        <h2 className={styles.sectionTitle}>Built for teams of every size.</h2>

        <div className={styles.builtForRow}>
          {BUILT_FOR.map((b, i) => {
            const Icon = b.icon;
            return (
              <Reveal key={b.label} delayMs={i * 70} className={styles.builtForCard}>
                <span className={styles.builtForIcon} style={{ background: b.color }}>
                  <Icon size={22} color="#fff" />
                </span>
                {b.label}
              </Reveal>
            );
          })}
        </div>
      </section>

      <section className={styles.ctaBanner}>
        <Reveal>
          <h2 className={styles.ctaBannerTitle}>Ready to hire smarter with Nextenti?</h2>
          <p className={styles.ctaBannerSub}>Join as a candidate to start applying, or as an employer to start hiring.</p>
          <div className={styles.ctaBannerBtns}>
            <Link href="/login?role=candidate" className={styles.ctaBannerBtnLight}>
              <UserIcon size={15} color="currentColor" />
              I&apos;m a Candidate
            </Link>
            <Link href="/login?role=employer" className={styles.ctaBannerBtnOutline}>
              <BriefcaseIcon size={15} color="currentColor" />
              I&apos;m an Employer
            </Link>
          </div>
        </Reveal>

        <footer className={styles.footer}>
          <div className={styles.footerTop}>
            <div className={styles.footerBrandCol}>
              <div className={styles.navBrand}>
                <Logo size={26} radius={7} />
                <div className={styles.navBrandLockup}>
                  <span className={styles.navBrandName} style={{ fontSize: "16px" }}>Nextenti</span>
                  <span className={styles.navBrandTagline} style={{ fontSize: "10.5px" }}>Talent Flow</span>
                </div>
              </div>
              <p className={styles.footerTagline}>
                AI screening and live video interviews, in one shared hiring pipeline.
              </p>
            </div>

            <div className={styles.footerLinkCol}>
              <span className={styles.footerColTitle}>Product</span>
              <a href="#features">Features</a>
              <a href="#how-it-works">How It Works</a>
              <a href="#built-for">Who It&apos;s For</a>
            </div>

            <div className={styles.footerLinkCol}>
              <span className={styles.footerColTitle}>For Candidates</span>
              <Link href="/login?role=candidate">Browse Open Roles</Link>
              <Link href="/login?role=candidate">Track My Applications</Link>
            </div>

            <div className={styles.footerLinkCol}>
              <span className={styles.footerColTitle}>For Employers</span>
              <Link href="/login?role=employer">Post a Job</Link>
              <Link href="/login?role=employer">Candidate Pool</Link>
            </div>

            <div className={styles.footerLinkCol}>
              <span className={styles.footerColTitle}>Legal</span>
              <a href="#">Terms of Use</a>
              <a href="#">Privacy Policy</a>
              <a href="#">Cookie Policy</a>
            </div>
          </div>

          <div className={styles.footerBottom}>
            <span className={styles.footerText}>© {new Date().getFullYear()} Nextenti. All rights reserved.</span>
          </div>
        </footer>
      </section>
    </div>
  );
}
