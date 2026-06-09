"use client";

import { useT } from "@/components/locale-provider";
import { fontMono, fontSerif, paper } from "@/lib/paper-theme";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

export default function ResetPasswordPage() {
  const t = useT();
  const router = useRouter();
  const qc = useQueryClient();
  const { token } = useParams<{ token: string }>();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
    if (password.length < 8) {
      setError(t("invite.too_short"));
      return;
    }
    if (password !== confirm) {
      setError(t("invite.mismatch"));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/auth/reset/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        qc.clear();
        router.replace("/");
      } else {
        setError(t("auth.reset_error"));
        setLoading(false);
      }
    } catch {
      setError(t("auth.reset_error"));
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: paper.paperDeep,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 360 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div
            style={{
              fontFamily: fontSerif,
              fontSize: 26,
              fontWeight: 600,
              color: paper.ink,
              letterSpacing: -0.5,
              marginBottom: 6,
            }}
          >
            {t("auth.reset_title")}
          </div>
          <div
            style={{
              fontFamily: fontMono,
              fontSize: 11,
              color: paper.inkDim,
              letterSpacing: 0.5,
            }}
          >
            {t("auth.reset_subtitle")}
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            background: paper.paper,
            padding: "24px 20px",
            boxShadow: "0 4px 24px rgba(0,0,0,0.1)",
          }}
        >
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="reset-password" style={labelStyle}>
              {t("invite.password_label")}
            </label>
            <div style={{ position: "relative" }}>
              <input
                id="reset-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ ...inputStyle, paddingRight: 36 }}
                required
                autoFocus
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? t("action.hide_password") : t("action.show_password")}
                style={eyeButtonStyle}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label htmlFor="reset-confirm" style={labelStyle}>
              {t("invite.confirm_label")}
            </label>
            <input
              id="reset-confirm"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              style={inputStyle}
              required
            />
          </div>

          {error && (
            <div
              style={{
                fontFamily: fontMono,
                fontSize: 11,
                color: paper.accent,
                marginBottom: 16,
                letterSpacing: 0.5,
              }}
            >
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
            {loading ? t("state.loading") : t("invite.submit")}
          </button>
        </form>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontFamily: fontMono,
  fontSize: 9,
  letterSpacing: 1.5,
  textTransform: "uppercase",
  color: paper.inkDim,
  marginBottom: 6,
};

const eyeButtonStyle: React.CSSProperties = {
  position: "absolute",
  right: 10,
  top: "50%",
  transform: "translateY(-50%)",
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: 0,
  color: paper.inkMute,
  display: "flex",
};
