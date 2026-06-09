"use client";
import { fontMono, tokens } from "@/lib/theme-tokens";
import { useTheme } from "@/lib/theme-context";
import { useEffect, useRef, useState } from "react";

interface YearSelectProps {
  value: string;
  onChange: (year: string) => void;
  years: string[];
  allLabel: string;
}

export function YearSelect({ value, onChange, years, allLabel }: YearSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const mono = theme === "mono";

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
        style={
          mono
            ? {
                fontFamily: fontMono,
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: 0,
                textTransform: "none" as const,
                background: active ? tokens.ink : "transparent",
                color: active ? tokens.paper : tokens.inkDim,
                border: `1px solid ${tokens.paperDark}`,
                borderRadius: "var(--radius-pill, 999px)",
                padding: "4px 28px 4px 12px",
                cursor: "pointer",
                position: "relative",
                display: "block",
                whiteSpace: "nowrap",
              }
            : {
                fontFamily: fontMono,
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: 2,
                textTransform: "uppercase" as const,
                background: active ? tokens.ink : "transparent",
                color: active ? tokens.paper : tokens.inkDim,
                border: `1.5px solid ${tokens.ink}`,
                padding: "5px 24px 5px 12px",
                cursor: "pointer",
                position: "relative",
                display: "block",
                whiteSpace: "nowrap",
              }
        }
      >
        {value || allLabel}
        <span
          style={{
            position: "absolute",
            right: 8,
            top: "50%",
            transform: "translateY(-50%)",
            lineHeight: 1,
            fontSize: mono ? 10 : undefined,
          }}
        >
          {open ? "▴" : "▾"}
        </span>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 4px)",
            zIndex: 100,
            background: tokens.paper,
            border: mono ? `1px solid ${tokens.paperDark}` : `1.5px solid ${tokens.ink}`,
            borderRadius: mono ? "var(--radius-md, 10px)" : 0,
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            minWidth: "100%",
            overflow: "hidden",
          }}
        >
          {["", ...years].map((y) => (
            <button
              key={y || "__all"}
              onClick={() => {
                onChange(y);
                setOpen(false);
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                fontFamily: fontMono,
                fontSize: mono ? 12 : 9,
                fontWeight: mono ? 500 : 700,
                letterSpacing: mono ? 0 : 2,
                textTransform: mono ? "none" : ("uppercase" as const),
                background: value === y ? tokens.ink : tokens.paper,
                color: value === y ? tokens.paper : tokens.ink,
                border: "none",
                borderBottom: `1px solid ${tokens.paperDark}`,
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
