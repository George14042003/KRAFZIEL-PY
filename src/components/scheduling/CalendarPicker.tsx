"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

const TIME_OPTIONS = Array.from({ length: (24 * 60) / 15 }, (_, i) => {
  const totalMinutes = i * 15;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const value = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  const label = new Date(2000, 0, 1, hours, minutes).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return { value, label };
});

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function daysInMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** A self-contained month-grid date picker + 15-minute time picker. Emits a
 * combined ISO-ish local datetime string via onChange, matching what a
 * <input type="datetime-local"> would give (yyyy-MM-ddTHH:mm) so callers can
 * swap it in without changing how the value is consumed downstream. */
export function CalendarPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const parsed = value ? new Date(value) : null;
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(parsed ?? new Date()));
  const [time, setTime] = useState(() => (parsed ? `${String(parsed.getHours()).padStart(2, "0")}:${String(parsed.getMinutes()).padStart(2, "0")}` : "10:00"));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  function emit(day: Date, timeValue: string) {
    const [h, m] = timeValue.split(":").map(Number);
    const combined = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
    const iso = `${combined.getFullYear()}-${String(combined.getMonth() + 1).padStart(2, "0")}-${String(combined.getDate()).padStart(2, "0")}T${String(combined.getHours()).padStart(2, "0")}:${String(combined.getMinutes()).padStart(2, "0")}`;
    onChange(iso);
  }

  function selectDay(day: Date) {
    emit(day, time);
  }

  function selectTime(newTime: string) {
    setTime(newTime);
    if (parsed) emit(parsed, newTime);
  }

  const firstWeekday = visibleMonth.getDay();
  const totalDays = daysInMonth(visibleMonth);
  const cells: (Date | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: totalDays }, (_, i) => new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), i + 1)),
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button
          type="button"
          onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))}
          style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: "13px", color: "#64748b", padding: "4px 8px" }}
        >
          ←
        </button>
        <span style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>
          {visibleMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </span>
        <button
          type="button"
          onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))}
          style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: "13px", color: "#64748b", padding: "4px 8px" }}
        >
          →
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px" }}>
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i} style={{ textAlign: "center", fontSize: "10px", fontWeight: 800, color: "#94a3b8", padding: "2px 0" }}>
            {d}
          </div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const isPast = day < today;
          const isSelected = parsed ? isSameDay(day, parsed) : false;
          const isToday = isSameDay(day, today);
          return (
            <button
              key={i}
              type="button"
              disabled={isPast}
              onClick={() => selectDay(day)}
              style={{
                aspectRatio: "1",
                borderRadius: "8px",
                border: isToday ? "1px solid #01617a" : "1px solid transparent",
                background: isSelected ? "#01617a" : "transparent",
                color: isPast ? "#cbd5e1" : isSelected ? "#fff" : "#0f172a",
                fontSize: "12px",
                fontWeight: isSelected ? 700 : 500,
                cursor: isPast ? "default" : "pointer",
              }}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>

      <div>
        <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
          Time
        </label>
        <select
          value={time}
          onChange={(e) => selectTime(e.target.value)}
          style={{
            width: "100%",
            padding: "9px 12px",
            border: "1px solid #e2e8f0",
            borderRadius: "10px",
            fontSize: "13px",
            color: "#0f172a",
          }}
        >
          {TIME_OPTIONS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {parsed && (
        <p style={{ fontSize: "11.5px", color: "#64748b", margin: 0 }}>
          Selected:{" "}
          <strong style={{ color: "#0f172a" }}>
            {parsed.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
          </strong>
        </p>
      )}
    </div>
  );
}

/** A trigger button showing the current selection, which opens the
 * CalendarPicker in a dropdown panel — drops straight into a form grid cell
 * the same way a plain <input type="datetime-local"> would. */
export function CalendarPickerField({
  value,
  onChange,
  inputStyle,
}: {
  value: string;
  onChange: (value: string) => void;
  inputStyle: CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const label = value
    ? new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : "Choose date & time…";

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          ...inputStyle,
          textAlign: "left",
          background: "#fff",
          cursor: "pointer",
          color: value ? "#0f172a" : "#94a3b8",
        }}
      >
        {label}
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 30,
            width: "260px",
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: "14px",
            padding: "14px",
            boxShadow: "0 20px 45px rgba(15,23,42,0.18)",
          }}
        >
          <CalendarPicker value={value} onChange={onChange} />
        </div>
      )}
    </div>
  );
}
