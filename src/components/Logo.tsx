type LogoProps = {
  /** Rendered width/height of the square icon, in px. */
  size?: number;
  /** Corner radius of the icon, in px. */
  radius?: number;
};

export function Logo({ size = 40, radius = 10 }: LogoProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.png?v=2"
      alt="Nextenti"
      width={size}
      height={size}
      style={{ width: size, height: size, borderRadius: radius, display: "block", flexShrink: 0 }}
    />
  );
}
