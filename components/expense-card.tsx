"use client";
import { CarBadge } from "@/components/car-badge";
import { useLocale, useT } from "@/components/locale-provider";
import { PendingBadge } from "@/components/pending-badge";
import { useTheme } from "@/lib/theme-context";
import { fmtDate, fmtMoney, fontMono, fontSerif, tokens } from "@/lib/theme-tokens";
import type { Expense } from "@/types";

export interface ExpenseCardProps {
  expense: Expense;
  onClick?: () => void;
}

export function ExpenseCard({ expense, onClick }: ExpenseCardProps) {
  const t = useT();
  const { locale } = useLocale();
  const { theme } = useTheme();
  const mono = theme === "mono";
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        appearance: "none",
        background: mono ? "transparent" : tokens.paper,
        padding: "12px 14px",
        marginBottom: mono ? 0 : 8,
        display: "flex",
        alignItems: "center",
        gap: 12,
        borderTop: "none",
        borderRight: "none",
        borderBottom: mono ? `1px solid ${tokens.paperDark}` : "none",
        borderLeft: mono ? "none" : `3px solid ${tokens.green}`,
        boxShadow: mono ? "none" : "0 1px 2px rgba(0,0,0,0.04)",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <CarBadge short={expense.car_short ?? "?"} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: fontSerif,
            fontSize: 15,
            color: tokens.ink,
            fontWeight: 600,
            lineHeight: 1.2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {expense.description ?? t("dashboard.maintenance_label")}
          {expense.id < 0 && <PendingBadge />}
        </div>
        <div
          style={{
            fontFamily: fontMono,
            fontSize: mono ? 11.5 : 10,
            color: tokens.inkDim,
            letterSpacing: mono ? 0 : 1,
            marginTop: 2,
          }}
        >
          {expense.person_name} · {fmtDate(expense.date, locale)}
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div
          style={{
            fontFamily: fontMono,
            fontSize: 14,
            fontWeight: 700,
            color: expense.settled_outside === 1 ? tokens.inkMute : tokens.green,
            whiteSpace: "nowrap",
          }}
        >
          {fmtMoney(expense.amount)}
          {expense.settled_outside === 1 && (
            <span
              style={{
                display: "inline-block",
                padding: "1px 5px",
                fontFamily: fontMono,
                fontSize: 8,
                letterSpacing: 1,
                textTransform: "uppercase",
                color: tokens.inkMute,
                border: `1px solid ${tokens.paperDark}`,
                marginLeft: 5,
                verticalAlign: "middle",
              }}
            >
              {t("badge.settled_outside")}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
