"use client";
import { useState, useRef, useEffect } from "react";
import { paper, fontMono } from "@/lib/paper-theme";

interface YearSelectProps {
  value: string;
  onChange: (year: string) => void;
  years: string[];
  allLabel: string;
}

export function YearSelect({ value, onChange, years, allLabel }: YearSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const active = !!value;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          fontFamily: fontMono, fontSize: 9, fontWeight: 700, letterSpacing: 2,
          textTransform: "uppercase",
          background: active ? paper.ink : "transparent",
          color: active ? paper.paper : paper.inkDim,
          border: `1.5px solid ${paper.ink}`,
          padding: "5px 24px 5px 12px",
          cursor: "pointer",
          position: "relative",
          display: "block",
          whiteSpace: "nowrap",
        }}
      >
        {value || allLabel}
        <span style={{
          position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
          lineHeight: 1,
        }}>
          {open ? "▴" : "▾"}
        </span>
      </button>

      {open && (
        <div style={{
          position: "absolute", right: 0, top: "100%", zIndex: 100,
          background: paper.paper,
          border: `1.5px solid ${paper.ink}`,
          boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
          minWidth: "100%",
        }}>
          {["", ...years].map((y) => (
            <button
              key={y || "__all"}
              onClick={() => { onChange(y); setOpen(false); }}
              style={{
                display: "block", width: "100%", textAlign: "left",
                fontFamily: fontMono, fontSize: 9, fontWeight: 700,
                letterSpacing: 2, textTransform: "uppercase",
                background: value === y ? paper.ink : paper.paper,
                color: value === y ? paper.paper : paper.ink,
                border: "none",
                borderBottom: `1px solid ${paper.paperDark}`,
                padding: "8px 14px",
                cursor: "pointer",
              }}
            >
              {y || allLabel}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
