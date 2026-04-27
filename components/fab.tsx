"use client";
import { useState } from "react";
import { toast } from "sonner";
import { paper, fontMono } from "@/lib/paper-theme";
import { t } from "@/lib/i18n";
import { useOnlineState } from "@/lib/offline/online-state";

const CHIT_DEFS = [
  { key: "expense", labelKey: "fab.expense" as const, emoji: "🧾", rotate:  2 },
  { key: "reserve", labelKey: "fab.reservation" as const, emoji: "📅", rotate: -2 },
  { key: "fuel",    labelKey: "fab.fuel" as const, emoji: "⛽", rotate:  1 },
  { key: "trip",    labelKey: "fab.trip" as const, emoji: "🚗", rotate: -1 },
];

interface Props {
  onClick: () => void;
  label?: string;
  onPick?: (action: string) => void;
}

export function Fab({ onClick, label }: Props) {
  const { online } = useOnlineState();
  const handleClick = () => {
    if (!online) { toast.error(t("offline.mutation_blocked")); return; }
    onClick();
  };
  return (
    <button
      onClick={handleClick}
      aria-label={label ?? t("action.add")}
      style={{
        position: "fixed",
        right: 20,
        bottom: 86,
        width: 56,
        height: 56,
        background: online ? paper.ink : paper.inkMute,
        color: paper.paper,
        border: "none",
        borderRadius: 0,
        cursor: online ? "pointer" : "default",
        fontFamily: fontMono,
        fontSize: 28,
        fontWeight: 700,
        lineHeight: 1,
        boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 20,
        opacity: online ? 1 : 0.45,
      }}
    >
      +
    </button>
  );
}

export function MultiFab({ onPick }: { onPick: (action: string) => void }) {
  const [open, setOpen] = useState(false);
  const { online } = useOnlineState();

  return (
    <div style={{
      position: "fixed",
      right: 16,
      bottom: 86,
      zIndex: 40,
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-end",
      gap: 10,
    }}>
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

      {open && CHIT_DEFS.map((chit) => (
        <button
          key={chit.key}
          onClick={() => { setOpen(false); onPick(chit.key); }}
          className="animate-pop-in"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 14px",
            background: paper.paper,
            border: `1.5px solid ${paper.ink}`,
            cursor: "pointer",
            fontFamily: fontMono,
            fontSize: 11,
            letterSpacing: 2,
            textTransform: "uppercase" as const,
            fontWeight: 700,
            color: paper.ink,
            transform: `rotate(${chit.rotate}deg)`,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          }}
        >
          <span style={{ fontSize: 16 }}>{chit.emoji}</span>
          {t(chit.labelKey)}
        </button>
      ))}

      <button
        onClick={() => {
          if (!online) { toast.error(t("offline.mutation_blocked")); return; }
          setOpen((o) => !o);
        }}
        style={{
          width: 60,
          height: 60,
          background: online ? paper.ink : paper.inkMute,
          color: paper.paper,
          border: "none",
          cursor: online ? "pointer" : "default",
          fontFamily: fontMono,
          fontSize: 34,
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
  );
}
