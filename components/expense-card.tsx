"use client";
import type { Expense } from "@/types";
import { paper, fontMono, fontSerif, fmtMoney, fmtDate } from "@/lib/paper-theme";
import { useT, useLocale } from "@/components/locale-provider";
import { CarBadge } from "@/components/car-badge";
import { PendingBadge } from "@/components/pending-badge";

export interface ExpenseCardProps {
  expense: Expense;
  onClick?: () => void;
}

export function ExpenseCard({ expense, onClick }: ExpenseCardProps) {
  const t = useT();
  const { locale } = useLocale();
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        appearance: "none",
        background: paper.paper,
        padding: "12px 14px",
        marginBottom: 8,
        display: "flex",
        alignItems: "center",
        gap: 12,
        borderTop: "none",
        borderRight: "none",
        borderBottom: "none",
        borderLeft: `3px solid ${paper.green}`,
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <CarBadge short={expense.car_short ?? "?"} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: fontSerif,
            fontSize: 15,
            color: paper.ink,
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
            fontSize: 10,
            color: paper.inkDim,
            letterSpacing: 1,
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
            color: expense.settled_outside === 1 ? paper.inkMute : paper.green,
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
                color: paper.inkMute,
                border: `1px solid ${paper.paperDark}`,
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
