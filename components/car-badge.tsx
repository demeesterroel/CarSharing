"use client";
import { fontMono, paper } from "@/lib/paper-theme";
import { useTheme } from "@/lib/theme-context";

export function CarBadge({ short, active = true }: { short: string; active?: boolean }) {
  const { theme } = useTheme();
  return (
    <div
      style={{
        padding: "6px 8px",
        background: active ? paper.ink : paper.inkDim,
        color: paper.paper,
        fontFamily: fontMono,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: theme === "mono" ? 1 : 2,
        flexShrink: 0,
        minWidth: 42,
        textAlign: "center",
        borderRadius: theme === "mono" ? 8 : 0,
      }}
    >
      {short}
    </div>
  );
}
