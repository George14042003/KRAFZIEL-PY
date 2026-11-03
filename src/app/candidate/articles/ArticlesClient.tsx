"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import aurora from "@/components/aurora/aurora.module.css";
import { AuroraPageHeader } from "@/components/aurora/AuroraPageHeader";
import { ARTICLES, formatArticleDate, type Article } from "@/lib/articles";
import s from "./articles.module.css";

const CATEGORIES: ("All" | Article["category"])[] = ["All", "Process", "Preparation", "Technical", "Offer & pay"];

export function ArticlesClient() {
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("All");
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ARTICLES.filter(
      (a) => (category === "All" || a.category === category) && (!q || `${a.title} ${a.summary}`.toLowerCase().includes(q))
    );
  }, [category, query]);

  return (
    <>
      <AuroraPageHeader
        eyebrow="Learn"
        title="Interview articles"
        subtitle="Practical guides on how interview processes work today, how to prepare for each stage, and how to handle the offer."
      />

      <div className={s.col}>
        <div className={s.filters}>
          {CATEGORIES.map((c) => (
            <button key={c} type="button" aria-pressed={category === c} className={`${s.pill} ${category === c ? s.pillOn : ""}`} onClick={() => setCategory(c)}>
              {c}
            </button>
          ))}
          <div className={`${aurora.field} ${s.search}`}>
            <label className={s.meta} htmlFor="article-search" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
              Search articles
            </label>
            <input id="article-search" className={aurora.inp} style={{ minHeight: 40 }} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search articles" />
          </div>
        </div>

        {visible.length === 0 ? (
          <div className={`${aurora.glass} ${aurora.card} ${s.empty}`}>No articles match. Try another category or search.</div>
        ) : (
          <div className={s.grid}>
            {visible.map((a) => (
              <Link key={a.slug} href={`/candidate/articles/${a.slug}`} className={`${aurora.glass} ${aurora.card} ${s.card}`}>
                <span className={s.tag}>{a.category}</span>
                <h2 className={s.cardTitle}>{a.title}</h2>
                <p className={s.cardSummary}>{a.summary}</p>
                <span className={s.meta}>
                  {a.readMinutes} min read · Updated {formatArticleDate(a.updated)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
