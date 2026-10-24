import type { CSSProperties } from "react";

export const inputStyle: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
  fontSize: "13px",
  color: "#0f172a",
  boxSizing: "border-box",
  fontFamily: "inherit",
  transition: "border-color 0.15s ease, box-shadow 0.15s ease",
};

export const labelStyle: CSSProperties = {
  display: "block",
  fontSize: "11px",
  fontWeight: 700,
  color: "#334155",
  marginBottom: "6px",
};

export const primaryButtonStyle: CSSProperties = {
  padding: "10px 18px",
  background: "linear-gradient(135deg, #0891b2, #01617a)",
  color: "#fff",
  border: "none",
  borderRadius: "10px",
  fontWeight: 700,
  fontSize: "13px",
  cursor: "pointer",
  boxShadow: "0 1px 2px rgba(1,97,122,0.25), 0 4px 10px rgba(1,97,122,0.18)",
  transition: "transform 0.1s ease, box-shadow 0.15s ease, opacity 0.15s ease",
};

export const secondaryButtonStyle: CSSProperties = {
  padding: "10px 18px",
  background: "#fff",
  color: "#334155",
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
  fontWeight: 700,
  fontSize: "13px",
  cursor: "pointer",
  boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
  transition: "background 0.15s ease, border-color 0.15s ease",
};

export const dangerButtonStyle: CSSProperties = {
  padding: "10px 18px",
  background: "#fff",
  color: "#dc2626",
  border: "1px solid #fecaca",
  borderRadius: "10px",
  fontWeight: 700,
  fontSize: "13px",
  cursor: "pointer",
  transition: "background 0.15s ease, border-color 0.15s ease",
};

export const cardStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid #eef1f5",
  borderRadius: "16px",
  padding: "24px",
  boxShadow: "0 1px 2px rgba(15,23,42,0.04), 0 8px 24px rgba(15,23,42,0.06)",
};
