"use client";
import { useMe } from "@/hooks/use-me";
import { fontMono, tokens } from "@/lib/theme-tokens";

export function CloakBanner() {
  const { data: me } = useMe();

  if (!me?.isCloaked) return null;

  // Determine role label
  let roleLabel = "member";
  if (me.isOwner) roleLabel = "owner";
  else if (me.isAdmin) roleLabel = "admin";

  async function handleExit() {
    await fetch("/api/auth/uncloak", { method: "POST" });
    window.location.href = "/admin/members";
  }

  return (
    <div
      role="alert"
      style={{
        background: tokens.amber,
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 16px",
        fontFamily: fontMono,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 1.5,
        textTransform: "uppercase",
        gap: 8,
      }}
    >
      <span>
        Viewing as {me.shortName} ({roleLabel})
      </span>
      <button
        onClick={handleExit}
        style={{
          background: "rgba(0,0,0,0.25)",
          color: "#fff",
          border: "none",
          padding: "5px 10px",
          fontFamily: fontMono,
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        Exit cloaking
      </button>
    </div>
  );
}
