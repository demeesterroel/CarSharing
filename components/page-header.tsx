"use client";
import { useRouter } from "next/navigation";
import { paper, fontMono, fontSerif } from "@/lib/paper-theme";
import { useT } from "@/components/locale-provider";
import { LangSwitcher } from "./lang-switcher";

interface Props {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}

export function PageHeader({ title, subtitle, right }: Props) {
  const t = useT();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  };

  return (
    <header
      style={{
        background: paper.paper,
        padding: "18px 20px 16px",
        borderBottom: `1.5px dashed ${paper.ink}`,
        position: "sticky",
        top: 0,
        zIndex: 20,
      }}
    >
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 4,
      }}>
        <div style={{
          fontFamily: fontMono,
          fontSize: 9,
          color: paper.inkDim,
          letterSpacing: 2,
          textTransform: "uppercase" as const,
        }}>
          {t("brand.tagline")}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {right}
          <LangSwitcher />
          <button
            onClick={handleLogout}
            title={t("nav.logout")}
            style={{
              padding: "3px 8px",
              fontFamily: fontMono, fontSize: 9, fontWeight: 700,
              letterSpacing: 1.5, textTransform: "uppercase",
              background: "transparent", color: paper.inkDim,
              border: `1.5px solid ${paper.paperDark}`,
              cursor: "pointer", lineHeight: 1.6,
            }}
          >
            ⏻
          </button>
        </div>
      </div>
      <div style={{
        fontFamily: fontSerif,
        fontSize: 26,
        fontWeight: 700,
        color: paper.ink,
        letterSpacing: -0.5,
        lineHeight: 1.1,
      }}>
        {title}
      </div>
      {subtitle && (
        <div style={{
          fontFamily: fontMono,
          fontSize: 10,
          color: paper.inkDim,
          letterSpacing: 1.5,
          textTransform: "uppercase" as const,
          marginTop: 4,
        }}>
          {subtitle}
        </div>
      )}
    </header>
  );
}
