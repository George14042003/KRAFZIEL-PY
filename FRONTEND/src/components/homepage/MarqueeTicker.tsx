import styles from "./MarqueeTicker.module.css";

const ITEMS = [
  "AI-screened, every time",
  "Live video, zero setup",
  "One shared candidate pipeline",
  "Calendar-based scheduling",
  "Candidate availability confirmed upfront",
  "Consent-first interview recording",
  "Identity-verified interviews",
  "Job postings candidates can apply to",
];

export function MarqueeTicker() {
  const doubled = [...ITEMS, ...ITEMS];
  return (
    <div className={styles.wrap}>
      <div className={styles.track}>
        {doubled.map((item, i) => (
          <span key={i} className={styles.item}>
            <span className={styles.dot} />
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
