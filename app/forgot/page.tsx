"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/locale-provider";
import { paper, fontMono, fontSerif } from "@/lib/paper-theme";

export default function ForgotPasswordPage() {
  const t = useT();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (endpoint: "/api/auth/forgot" | "/api/auth/magic") => {
    setError(null);
    setLoading(true);
    try {
      // These endpoints always return 200 (no account enumeration); show the
      // same confirmation regardless of whether the email matched an account.
      await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch {
      setError(t("auth.forgot_error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: paper.paperDeep,
        padding: "16px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <h1
            style={{
              fontFamily: fontSerif,
              fontSize: 26,
              fontWeight: 700,
              color: paper.ink,
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            {t("auth.forgot_title")}
          </h1>
          <p
            style={{
              fontFamily: fontMono,
              fontSize: 11,
              color: paper.inkDim,
              marginTop: 8,
              letterSpacing: 0.5,
            }}
          >
            {t("auth.forgot_subtitle")}
          </p>
        </div>

        <div
          style={{
            background: paper.paper,
            padding: "32px 28px",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.06)",
          }}
        >
          {sent ? (
            <p
              role="status"
              style={{ fontFamily: fontMono, fontSize: 12, color: paper.ink, lineHeight: 1.6 }}
            >
              {t("auth.forgot_sent")}
            </p>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit("/api/auth/forgot");
              }}
            >
              <div style={{ marginBottom: 20 }}>
                <label htmlFor="forgot-email" style={labelStyle}>
                  {t("auth.email")}
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  style={inputStyle}
                />
              </div>
              {error && (
                <p
                  style={{ fontFamily: fontMono, fontSize: 11, color: "#c0392b", marginBottom: 16 }}
                >
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={loading || !email}
                style={primaryButtonStyle(loading)}
              >
                {t("auth.send_reset_link")}
              </button>
              <button
                type="button"
                disabled={loading || !email}
                onClick={() => submit("/api/auth/magic")}
                style={secondaryButtonStyle}
              >
                {t("auth.send_magic_link")}
              </button>
            </form>
          )}

          <button
            type="button"
            onClick={() => router.push("/login")}
            style={{
              display: "block",
              width: "100%",
              marginTop: 20,
              background: "none",
              border: "none",
              fontFamily: fontMono,
              fontSize: 11,
              color: paper.inkDim,
              cursor: "pointer",
            }}
          >
            {t("auth.back_to_login")}
          </button>
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontFamily: fontMono,
  fontSize: 10,
  letterSpacing: 1.5,
  textTransform: "uppercase",
  color: paper.inkDim,
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid " + paper.paperDark,
  background: paper.paperDeep,
  fontFamily: fontMono,
  fontSize: 13,
  color: paper.ink,
  outline: "none",
  appearance: "none",
  boxSizing: "border-box",
};

const primaryButtonStyle = (loading: boolean): React.CSSProperties => ({
  width: "100%",
  background: loading ? paper.inkDim : paper.ink,
  color: paper.paper,
  fontFamily: fontMono,
  fontSize: 10,
  letterSpacing: 2,
  textTransform: "uppercase",
  padding: "14px",
  border: "none",
  cursor: loading ? "not-allowed" : "pointer",
});

const secondaryButtonStyle: React.CSSProperties = {
  width: "100%",
  background: "transparent",
  color: paper.ink,
  fontFamily: fontMono,
  fontSize: 10,
  letterSpacing: 2,
  textTransform: "uppercase",
  padding: "13px",
  marginTop: 12,
  border: `1.5px solid ${paper.paperDark}`,
  cursor: "pointer",
};
