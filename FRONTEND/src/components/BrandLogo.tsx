import styles from "./BrandLogo.module.css";

type BrandLogoProps = {
  /** Image height in px. Omit to size it from CSS instead. */
  height?: number | string;
  /** Use the dark-text artwork on a light page. Defaults to the light-text artwork made for dark headers. */
  onLight?: boolean;
};

/** The Krafziel logo. Two transparent versions so it blends into the surface behind it. */
export function BrandLogo({ height, onLight = false }: BrandLogoProps) {
  return (
    <span className={styles.logo}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={onLight ? "/krafziel-logo.png" : "/krafziel-logo-light.png"}
        alt="Krafziel"
        style={height ? { height } : undefined}
      />
    </span>
  );
}
