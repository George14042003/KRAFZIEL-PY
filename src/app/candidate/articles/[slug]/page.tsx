import Link from "next/link";
import { notFound } from "next/navigation";
import aurora from "@/components/aurora/aurora.module.css";
import { ARTICLES, formatArticleDate, getArticle } from "@/lib/articles";
import s from "../articles.module.css";

export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const article = getArticle((await params).slug);
  return { title: article ? article.title : "Article" };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();

  const related = ARTICLES.filter((a) => a.slug !== article.slug).slice(0, 3);

  return (
    <article className={s.article}>
      <Link href="/candidate/articles" className={s.back}>
        ← All articles
      </Link>
      <div>
        <span className={s.tag}>{article.category}</span>
        <h1 className={s.aTitle}>{article.title}</h1>
        <p className={s.aSummary}>{article.summary}</p>
        <p className={s.meta} style={{ marginTop: 10 }}>
          {article.readMinutes} min read · Last reviewed {formatArticleDate(article.updated)}
        </p>
      </div>

      <div className={`${aurora.glass} ${aurora.card} ${s.body}`}>
        {article.body.map((block, i) => {
          if (block.type === "h2") return <h2 key={i}>{block.text}</h2>;
          if (block.type === "ul")
            return (
              <ul key={i}>
                {block.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            );
          if (block.type === "tip")
            return (
              <p key={i} className={s.tip}>
                <b>Tip: </b>
                {block.text}
              </p>
            );
          return <p key={i}>{block.text}</p>;
        })}
      </div>

      <div className={`${aurora.glass} ${aurora.card} ${s.cta}`}>
        <p className={s.ctaText}>
          <b>Put it into practice</b>
          Run a mock interview and get instant feedback on your answers.
        </p>
        <Link href="/candidate/mock-interviews" className={`${aurora.btn} ${aurora.btnAccent}`}>
          Start a mock interview
        </Link>
      </div>

      <h2 className={s.moreHead}>Keep reading</h2>
      <div className={s.more}>
        {related.map((a) => (
          <Link key={a.slug} href={`/candidate/articles/${a.slug}`} className={s.moreItem}>
            {a.title}
            <small>{a.readMinutes} min read</small>
          </Link>
        ))}
      </div>
    </article>
  );
}
