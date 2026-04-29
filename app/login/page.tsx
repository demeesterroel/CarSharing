"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useT } from "@/components/locale-provider";
import { LangSwitcher } from "@/components/lang-switcher";
import { paper, fontMono, fontSerif } from "@/lib/paper-theme";

export default function LoginPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const t = useT();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
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
          {/* Username field */}
          <div style={{ marginBottom: 20 }}>
            <label
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
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
        </form>
      </div>
    </div>
  );
}
