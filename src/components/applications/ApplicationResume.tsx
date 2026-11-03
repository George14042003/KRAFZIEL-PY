"use client";

import { useEffect, useRef, useState } from "react";
import type { JobApplication, PortfolioData } from "@/lib/jobs";
import s from "./ApplicationResume.module.css";

/** The candidate's resume as read for this application (not the uploaded file) plus their portfolio. */
export function ApplicationResumePanel({ application }: { application: JobApplication }) {
  const r = application.resume_data;
  const [viewing, setViewing] = useState(false);

  if (!r && !application.portfolio_url) {
    return <p className={s.hint}>No resume was uploaded with this application.</p>;
  }

  return (
    <div className={s.col}>
      {r && (
        <>
          <div className={s.head}>
            <div>
              <h3 className={s.name}>{r.name || application.candidate.applicant_name}</h3>
              {r.headline && <p className={s.headline}>{r.headline}</p>}
              <span className={s.meta}>
                For {application.job_title} · read from {application.resume_filename || "uploaded resume"}
                {r.source === "basic" ? " · quick read, detailed summary pending" : ""}
              </span>
            </div>
            {r.total_experience_years !== null && (
              <span className={s.years}>{r.total_experience_years === 0 ? "Fresher" : `${r.total_experience_years} yrs experience`}</span>
            )}
          </div>

          {r.summary && (
            <div>
              <h4 className={s.section}>Summary</h4>
              <p className={s.text}>{r.summary}</p>
            </div>
          )}

          {r.skills.length > 0 && (
            <div>
              <h4 className={s.section}>Skills</h4>
              <div className={s.chips}>
                {r.skills.map((k) => (
                  <span key={k} className={s.chip}>
                    {k}
                  </span>
                ))}
              </div>
            </div>
          )}

          {r.experience.length > 0 && (
            <div>
              <h4 className={s.section}>Experience</h4>
              <div className={s.col}>
                {r.experience.map((e, i) => (
                  <div key={i} className={s.job}>
                    <div className={s.jobTitle}>{[e.title, e.company].filter(Boolean).join(" · ") || "Role"}</div>
                    {e.period && <div className={s.jobPeriod}>{e.period}</div>}
                    {e.highlights.length > 0 && (
                      <ul className={s.bullets}>
                        {e.highlights.map((h, j) => (
                          <li key={j}>{h}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {r.projects.length > 0 && (
            <div>
              <h4 className={s.section}>Projects</h4>
              <div className={s.col}>
                {r.projects.map((p, i) => (
                  <div key={i} className={s.job}>
                    <div className={s.jobTitle}>{p.name}</div>
                    {p.description && <p className={s.text} style={{ marginTop: 4 }}>{p.description}</p>}
                    {p.tech && <div className={s.jobPeriod}>{p.tech}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {r.education.length > 0 && (
            <div>
              <h4 className={s.section}>Education</h4>
              <ul className={s.bullets} style={{ marginTop: 0 }}>
                {r.education.map((e, i) => (
                  <li key={i}>{[e.degree, e.institution, e.period].filter(Boolean).join(" · ")}</li>
                ))}
              </ul>
            </div>
          )}

          {r.certifications.length > 0 && (
            <div>
              <h4 className={s.section}>Certifications</h4>
              <ul className={s.bullets} style={{ marginTop: 0 }}>
                {r.certifications.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          )}

          {(r.links.length > 0 || r.email || r.phone) && (
            <div className={s.links}>
              {r.email && <span>{r.email}</span>}
              {r.phone && <span>{r.phone}</span>}
              {r.links.map((l) => (
                <a key={l.url} href={l.url} target="_blank" rel="noreferrer noopener">
                  {l.label}
                </a>
              ))}
            </div>
          )}
        </>
      )}

      {application.portfolio_url && (
        <div className={s.portfolio}>
          <div className={s.portfolioText}>
            <span className={s.badge}>● Portfolio shared</span>
            <div className={s.portfolioTitle} style={{ marginTop: 6 }}>
              {application.portfolio_data?.title || application.portfolio_url}
            </div>
            <p className={s.hint}>
              {application.portfolio_data
                ? application.portfolio_data.summary || application.portfolio_data.error || application.portfolio_url
                : "Reading the portfolio…"}
            </p>
          </div>
          <button type="button" className={s.primary} onClick={() => setViewing(true)}>
            View portfolio
          </button>
        </div>
      )}

      {viewing && application.portfolio_url && (
        <PortfolioViewer
          url={application.portfolio_url}
          data={application.portfolio_data}
          candidate={application.candidate.applicant_name}
          jobTitle={application.job_title}
          onClose={() => setViewing(false)}
        />
      )}
    </div>
  );
}

/** Shows the portfolio inside the app, next to what it contains and the role it was submitted for. */
export function PortfolioViewer({
  url,
  data,
  candidate,
  jobTitle,
  onClose,
}: {
  url: string;
  data: PortfolioData | null;
  candidate: string;
  jobTitle: string;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [frameFailed, setFrameFailed] = useState(false);
  // If the site says it can't be framed we skip the frame; if we couldn't check, we try and watch for a blank load.
  const canFrame = (data ? data.embeddable && data.status === "ok" : true) && !frameFailed;

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
      opener?.focus?.();
    };
  }, []);

  return (
    <div className={s.overlay} role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={s.modal} role="dialog" aria-modal="true" aria-label={`Portfolio of ${candidate}`}>
        <div className={s.modalHead}>
          <h3 className={s.modalTitle}>
            {candidate}&apos;s portfolio · applied for {jobTitle}
          </h3>
          <div className={s.modalActions}>
            <a className={s.ghost} href={url} target="_blank" rel="noreferrer noopener">
              Open in new tab
            </a>
            <button ref={closeRef} type="button" className={s.ghost} onClick={onClose}>
              Close
            </button>
          </div>
        </div>
        <div className={s.modalBody}>
          <div className={s.frameWrap}>
            {canFrame ? (
              <iframe
                className={s.frame}
                src={url}
                title={`Portfolio of ${candidate}`}
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                referrerPolicy="no-referrer"
                loading="lazy"
                onError={() => setFrameFailed(true)}
              />
            ) : (
              <div className={s.blocked}>
                <strong>This site doesn&apos;t allow itself to be shown inside other pages.</strong>
                <span>You can still read the summary beside this, or open the portfolio in a new tab.</span>
                <a className={s.primary} href={url} target="_blank" rel="noreferrer noopener">
                  Open portfolio
                </a>
              </div>
            )}
          </div>
          <aside className={s.side} aria-label="Portfolio summary">
            <div>
              <h4 className={s.section}>What it shows</h4>
              <p className={s.text}>{data?.summary || data?.description || (data ? data.error : "Still being read…") || "No summary available."}</p>
            </div>
            {data?.highlights && data.highlights.length > 0 && (
              <div>
                <h4 className={s.section}>Highlights</h4>
                <ul className={s.bullets} style={{ marginTop: 0 }}>
                  {data.highlights.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              </div>
            )}
            {data?.technologies && data.technologies.length > 0 && (
              <div>
                <h4 className={s.section}>Technologies</h4>
                <div className={s.chips}>
                  {data.technologies.map((t) => (
                    <span key={t} className={s.chip}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <p className={s.hint}>Used to tailor this candidate&apos;s interview questions for {jobTitle}.</p>
          </aside>
        </div>
      </div>
    </div>
  );
}

/** Small marker for lists: shows when an application carries a portfolio link. */
export function PortfolioBadge({ application }: { application: JobApplication }) {
  if (!application.portfolio_url) return null;
  return <span className={s.badge}>● Portfolio shared</span>;
}
