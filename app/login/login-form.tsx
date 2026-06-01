"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff } from "lucide-react";
import { useT } from "@/components/locale-provider";
import { LangSwitcher } from "@/components/lang-switcher";
import { paper, fontMono, fontSerif } from "@/lib/paper-theme";

export default function LoginForm({ mailEnabled }: { mailEnabled: boolean }) {
  const router = useRouter();
  const qc = useQueryClient();
  const t = useT();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [magicEmail, setMagicEmail] = useState("");
  const [magicSent, setMagicSent] = useState(false);

  const submitMagic = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      // Always 200 (no account enumeration); show the same confirmation regardless.
      await fetch("/api/auth/magic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: magicEmail }),
      });
      setMagicSent(true);
    } catch {
      setError(t("auth.forgot_error"));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    if (mode === "magic") {
      await submitMagic(e);
      return;
    }
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        qc.clear();
        router.replace("/");
      } else {
        setError(t("error.invalid_credentials"));
      }
    } catch {
      setError(t("error.invalid_credentials"));
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
        {/* Branding */}
        <div
          style={{
            textAlign: "center",
            marginBottom: 32,
          }}
        >
          <h1
            style={{
              fontFamily: fontSerif,
              fontSize: 28,
              fontWeight: 700,
              color: paper.ink,
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            {t("brand.app")}
          </h1>
          <p
            style={{
              fontFamily: fontMono,
              fontSize: 11,
              color: paper.inkDim,
              marginTop: 6,
              letterSpacing: 1,
            }}
          >
            {t("brand.tagline")}
          </p>
          <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
            <LangSwitcher />
          </div>
        </div>

        {/* Card */}
        <form
          onSubmit={handleSubmit}
          style={{
            background: paper.paper,
            padding: "40px 32px",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.06)",
          }}
        >
          {mode === "password" && (
            <>
              {/* Username field */}
              <div style={{ marginBottom: 20 }}>
                <label
                  htmlFor="login-username"
                  style={{
                    display: "block",
                    fontFamily: fontMono,
                    fontSize: 10,
                    letterSpacing: 1.5,
                    textTransform: "uppercase",
                    color: paper.inkDim,
                    marginBottom: 6,
                  }}
                >
                  {t("form.name")}
                </label>
                <input
                  id="login-username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  style={{
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
                  }}
                />
              </div>

              {/* Password field */}
              <div style={{ marginBottom: 24 }}>
                <label
                  htmlFor="login-password"
                  style={{
                    display: "block",
                    fontFamily: fontMono,
                    fontSize: 10,
                    letterSpacing: 1.5,
                    textTransform: "uppercase",
                    color: paper.inkDim,
                    marginBottom: 6,
                  }}
                >
                  {t("form.password")}
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      paddingRight: 36,
                      border: "1px solid " + paper.paperDark,
                      background: paper.paperDeep,
                      fontFamily: fontMono,
                      fontSize: 13,
                      color: paper.ink,
                      outline: "none",
                      appearance: "none",
                      boxSizing: "border-box",
                    }}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? t("action.hide_password") : t("action.show_password")}
                    style={{
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
                    }}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Error message */}
              {error && (
                <p
                  style={{
                    fontFamily: fontMono,
                    fontSize: 11,
                    color: "#c0392b",
                    marginBottom: 16,
                    marginTop: 0,
                  }}
                >
                  {error}
                </p>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={loading}
                style={{
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
                  outline: "none",
                  appearance: "none",
                }}
              >
                {loading ? t("state.loading") : t("action.login")}
              </button>
            </>
          )}

          {mode === "password" && (
            <a
              href="/forgot"
              style={{
                display: "block",
                textAlign: "center",
                marginTop: 16,
                fontFamily: fontMono,
                fontSize: 10,
                letterSpacing: 1,
                color: paper.inkDim,
                textDecoration: "none",
              }}
            >
              {t("auth.forgot_password")}
            </a>
          )}

          {mailEnabled && mode === "password" && (
            <button
              type="button"
              onClick={() => setMode("magic")}
              style={{
                display: "block",
                width: "100%",
                marginTop: 12,
                background: "none",
                border: "none",
                fontFamily: fontMono,
                fontSize: 10,
                letterSpacing: 1,
                textTransform: "uppercase",
                color: paper.inkDim,
                cursor: "pointer",
              }}
            >
              {t("auth.use_magic_link")}
            </button>
          )}

          {mode === "magic" && (
            <div>
              {magicSent ? (
                <p
                  role="status"
                  style={{ fontFamily: fontMono, fontSize: 12, color: paper.ink, lineHeight: 1.6 }}
                >
                  {t("auth.forgot_sent")}
                </p>
              ) : (
                <div>
                  <div style={{ marginBottom: 20 }}>
                    <label
                      htmlFor="login-magic-email"
                      style={{
                        display: "block",
                        fontFamily: fontMono,
                        fontSize: 10,
                        letterSpacing: 1.5,
                        textTransform: "uppercase",
                        color: paper.inkDim,
                        marginBottom: 6,
                      }}
                    >
                      {t("auth.email")}
                    </label>
                    <input
                      id="login-magic-email"
                      type="email"
                      autoComplete="email"
                      value={magicEmail}
                      onChange={(e) => setMagicEmail(e.target.value)}
                      required
                      style={{
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
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    disabled={loading || !magicEmail}
                    onClick={submitMagic}
                    style={{
                      width: "100%",
                      background: loading ? paper.inkDim : paper.ink,
                      color: paper.paper,
                      fontFamily: fontMono,
                      fontSize: 10,
                      letterSpacing: 2,
                      textTransform: "uppercase",
                      padding: "14px",
                      border: "none",
                      cursor: loading || !magicEmail ? "not-allowed" : "pointer",
                    }}
                  >
                    {t("auth.send_magic_link")}
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  setMode("password");
                  setMagicSent(false);
                  setError(null);
                }}
                style={{
                  display: "block",
                  width: "100%",
                  marginTop: 16,
                  background: "none",
                  border: "none",
                  fontFamily: fontMono,
                  fontSize: 10,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  color: paper.inkDim,
                  cursor: "pointer",
                }}
              >
                {t("auth.use_password")}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
