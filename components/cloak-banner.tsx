"use client";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useMe } from "@/hooks/use-me";
import { paper, fontMono } from "@/lib/paper-theme";

export function CloakBanner() {
  const { data: me } = useMe();
  const router = useRouter();
  const qc = useQueryClient();

  if (!me?.isCloaked) return null;

  // Determine role label
  let roleLabel = "member";
  if (me.isOwner) roleLabel = "owner";
  else if (me.isAdmin) roleLabel = "admin";

  async function handleExit() {
    await fetch("/api/auth/uncloak", { method: "POST" });
    qc.invalidateQueries({ queryKey: ["me"] });
    router.push("/admin");
  }

  return (
    <div
      role="alert"
      style={{
        background: paper.amber,
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
        Viewing as {me.personName} ({roleLabel})
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
