import styles from "./BrandLogo.module.css";

/** The Elzuron artwork is less wide than the old logo, so heights are scaled up to keep it prominent. */
const SCALE = 1.4;

type BrandLogoProps = {
  /** Image height in px. Omit to size it from CSS instead. */
  height?: number | string;
  /** Use the dark-text artwork on a light page. Defaults to the light-text artwork made for dark headers. */
  onLight?: boolean;
};

/** The Elzuron logo. Two transparent versions so it blends into the surface behind it. */
export function BrandLogo({ height, onLight = false }: BrandLogoProps) {
  return (
    <span className={styles.logo}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={onLight ? "/elzuron-logo.png" : "/elzuron-logo-light.png"}
        alt="Elzuron"
        style={height ? { height: typeof height === "number" ? Math.round(height * SCALE) : `calc(${height} * ${SCALE})` } : undefined}
      />
    </span>
  );
}
