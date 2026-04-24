"use client";
import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { paper, fontMono, fontSerif } from "@/lib/paper-theme";
import { useT } from "@/components/locale-provider";

export default function InvitePage() {
  const t = useT();
  const router = useRouter();
  const { token } = useParams<{ token: string }>();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    border: `1.5px solid ${paper.inkDim}`,
    background: paper.paper,
    fontFamily: fontMono,
    fontSize: 14,
    color: paper.ink,
    outline: "none",
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) { setError(t("invite.too_short")); return; }
    if (password !== confirm) { setError(t("invite.mismatch")); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/invite/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.replace("/");
      } else {
        setError(t("invite.invalid"));
      }
    } catch {
      setError(t("invite.invalid"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100dvh",
      background: paper.paperDeep,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
    }}>
      <div style={{ width: "100%", maxWidth: 360 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            fontFamily: fontSerif,
            fontSize: 28,
            fontWeight: 600,
            color: paper.ink,
            letterSpacing: -0.5,
            marginBottom: 6,
          }}>
            {t("invite.title")}
          </div>
          <div style={{
            fontFamily: fontMono,
            fontSize: 11,
            color: paper.inkDim,
            letterSpacing: 1,
            textTransform: "uppercase",
          }}>
            {t("invite.subtitle")}
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{
          background: paper.paper,
          padding: "24px 20px",
          boxShadow: "0 4px 24px rgba(0,0,0,0.1)",
        }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{
              display: "block",
              fontFamily: fontMono,
              fontSize: 9,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              color: paper.inkDim,
              marginBottom: 6,
            }}>
              {t("invite.password_label")}
            </label>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
              required
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{
              display: "block",
              fontFamily: fontMono,
              fontSize: 9,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              color: paper.inkDim,
              marginBottom: 6,
            }}>
              {t("invite.confirm_label")}
            </label>
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              style={inputStyle}
              required
            />
          </div>

          {error && (
            <div style={{
              fontFamily: fontMono,
              fontSize: 11,
              color: paper.accent,
              marginBottom: 16,
              letterSpacing: 0.5,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px",
              background: loading ? paper.inkDim : paper.ink,
              color: paper.paper,
              border: "none",
              fontFamily: fontMono,
              fontSize: 11,
              letterSpacing: 2,
              textTransform: "uppercase",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "…" : t("invite.submit")}
          </button>
        </form>
      </div>
    </div>
  );
}
