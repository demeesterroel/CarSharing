"use client";
import { fontMono, tokens } from "@/lib/theme-tokens";
import { useTheme } from "@/lib/theme-context";

export function CarBadge({ short, active = true }: { short: string; active?: boolean }) {
  const { theme } = useTheme();
  return (
    <div
      style={{
        padding: "6px 8px",
        background: active ? tokens.ink : tokens.inkDim,
        color: tokens.paper,
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
