"use client";
import { t } from "@/lib/i18n";
import { useOnlineState } from "@/lib/offline/online-state";
import { fontMono, tokens } from "@/lib/theme-tokens";
import { useTheme } from "@/lib/theme-context";
import { CalendarPlus, Fuel, Navigation, Receipt } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const CHIT_DEFS = [
  { key: "expense", labelKey: "fab.expense" as const, emoji: "🧾", rotate: 2, Icon: Receipt },
  {
    key: "reserve",
    labelKey: "fab.reservation" as const,
    emoji: "📅",
    rotate: -2,
    Icon: CalendarPlus,
  },
  { key: "fuel", labelKey: "fab.fuel" as const, emoji: "⛽", rotate: 1, Icon: Fuel },
  { key: "trip", labelKey: "fab.trip" as const, emoji: "🚗", rotate: -1, Icon: Navigation },
];

interface Props {
  onClick: () => void;
  label?: string;
  onPick?: (action: string) => void;
}

export function Fab({ onClick, label }: Props) {
  const { online } = useOnlineState();
  const { theme } = useTheme();
  const mono = theme === "mono";
  const handleClick = () => {
    if (!online) {
      toast.error(t("offline.mutation_blocked"));
      return;
    }
    onClick();
  };
  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 86,
        maxWidth: 480,
        margin: "0 auto",
        pointerEvents: "none",
        zIndex: 20,
      }}
    >
      <button
        onClick={handleClick}
        aria-label={label ?? t("action.add")}
        style={{
          position: "absolute",
          right: 20,
          bottom: 0,
          width: 56,
          height: 56,
          background: online ? (mono ? tokens.accent : tokens.ink) : tokens.inkMute,
          color: tokens.paper,
          border: "none",
          borderRadius: mono ? "50%" : 0,
          cursor: online ? "pointer" : "default",
          fontFamily: fontMono,
          fontSize: 28,
          fontWeight: 700,
          lineHeight: 1,
          boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "auto",
          opacity: online ? 1 : 0.45,
        }}
      >
        +
      </button>
    </div>
  );
}

export function MultiFab({ onPick }: { onPick: (action: string) => void }) {
  const [open, setOpen] = useState(false);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const { online } = useOnlineState();
  const { theme } = useTheme();
  const mono = theme === "mono";

  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 86,
        maxWidth: 480,
        margin: "0 auto",
        pointerEvents: "none",
        zIndex: 40,
      }}
    >
      <div
        style={{
          position: "absolute",
          right: 20,
          bottom: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: mono ? 8 : 10,
          pointerEvents: "auto",
        }}
      >
        {open && (
          <div
            onClick={() => setOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(26,26,26,0.2)",
              backdropFilter: "blur(2px)",
              zIndex: -1,
            }}
          />
        )}

        {open &&
          CHIT_DEFS.map((chit) => {
            const hovered = hoveredKey === chit.key;
            return mono ? (
              <button
                key={chit.key}
                onClick={() => {
                  setOpen(false);
                  onPick(chit.key);
                }}
                onMouseEnter={() => setHoveredKey(chit.key)}
                onMouseLeave={() => setHoveredKey(null)}
                className="animate-pop-in"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "9px 16px",
                  background: hovered ? tokens.ink : tokens.paper,
                  border: `1px solid ${tokens.paperDark}`,
                  borderRadius: "var(--radius-pill, 999px)",
                  cursor: "pointer",
                  fontFamily: "var(--font-inter, 'Inter', system-ui, sans-serif)",
                  fontSize: 13,
                  fontWeight: 500,
                  letterSpacing: 0,
                  color: hovered ? tokens.paper : tokens.ink,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                  transition: "background 0.1s, color 0.1s",
                  whiteSpace: "nowrap",
                }}
              >
                <chit.Icon size={14} />
                {t(chit.labelKey)}
              </button>
            ) : (
              <button
                key={chit.key}
                onClick={() => {
                  setOpen(false);
                  onPick(chit.key);
                }}
                onMouseEnter={() => setHoveredKey(chit.key)}
                onMouseLeave={() => setHoveredKey(null)}
                className="animate-pop-in"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  background: hovered ? tokens.ink : tokens.paper,
                  border: `1.5px solid ${tokens.ink}`,
                  cursor: "pointer",
                  fontFamily: fontMono,
                  fontSize: 11,
                  letterSpacing: 2,
                  textTransform: "uppercase" as const,
                  fontWeight: 700,
                  color: hovered ? tokens.paper : tokens.ink,
                  transform: `rotate(${chit.rotate}deg)`,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                  transition: "background 0.1s, color 0.1s",
                }}
              >
                <span style={{ fontSize: 16 }}>{chit.emoji}</span>
                {t(chit.labelKey)}
              </button>
            );
          })}

        <button
          onClick={() => {
            if (!online) {
              toast.error(t("offline.mutation_blocked"));
              return;
            }
            setOpen((o) => !o);
          }}
          aria-label={t("fab.open_menu")}
          aria-expanded={open}
          style={{
            width: 56,
            height: 56,
            background: online ? (mono ? tokens.accent : tokens.ink) : tokens.inkMute,
            color: tokens.paper,
            border: "none",
            borderRadius: mono ? "50%" : 0,
            cursor: online ? "pointer" : "default",
            fontFamily: fontMono,
            fontSize: 28,
            fontWeight: 700,
            lineHeight: 1,
            boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
            transform: open ? "rotate(45deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease-out",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: online ? 1 : 0.45,
          }}
        >
          +
        </button>
      </div>
    </div>
  );
}
