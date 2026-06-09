"use client";

import { useT } from "@/components/locale-provider";
import { fontMono, fontSerif, paper } from "@/lib/paper-theme";
import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Password-reset / magic-link request form.
 *
 * `mailEnabled` reflects whether a mail transport is configured on the server
 * (env.MAIL_WEBHOOK_URL — see #277). When false, the request goes nowhere the
 * user can reach, so we show a "not available yet" notice and disable both
 * submit buttons instead of letting the user submit into a void.
 */
export default function ForgotForm({ mailEnabled }: { mailEnabled: boolean }) {
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

  const blocked = !mailEnabled;

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
          {blocked && (
            <p
              role="note"
              style={{
                fontFamily: fontMono,
                fontSize: 11,
                color: paper.amber,
                background: paper.amberBg,
                border: `1px solid ${paper.amberBorder}`,
                padding: "10px 12px",
                marginBottom: 20,
                lineHeight: 1.5,
              }}
            >
              {t("auth.forgot_unavailable")}
            </p>
          )}

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
                  disabled={blocked}
                  style={inputStyle}
                />
              </div>
              {error && (
                <p
                  style={{ fontFamily: fontMono, fontSize: 11, color: paper.accent, marginBottom: 16 }}
                >
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={loading || !email || blocked}
                style={primaryButtonStyle(loading || blocked)}
              >
                {t("auth.send_reset_link")}
              </button>
              <button
                type="button"
                disabled={loading || !email || blocked}
                onClick={() => submit("/api/auth/magic")}
                style={secondaryButtonStyle(blocked)}
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

const primaryButtonStyle = (greyed: boolean): React.CSSProperties => ({
  width: "100%",
  background: greyed ? paper.inkDim : paper.ink,
  color: paper.paper,
  fontFamily: fontMono,
  fontSize: 10,
  letterSpacing: 2,
  textTransform: "uppercase",
  padding: "14px",
  border: "none",
  cursor: greyed ? "not-allowed" : "pointer",
});

const secondaryButtonStyle = (greyed: boolean): React.CSSProperties => ({
  width: "100%",
  background: "transparent",
  color: greyed ? paper.inkDim : paper.ink,
  fontFamily: fontMono,
  fontSize: 10,
  letterSpacing: 2,
  textTransform: "uppercase",
  padding: "13px",
  marginTop: 12,
  border: `1.5px solid ${paper.paperDark}`,
  cursor: greyed ? "not-allowed" : "pointer",
});
