"use client";
import { useT } from "@/components/locale-provider";
import { YearSelect } from "@/components/year-select";
import { useTheme } from "@/lib/theme-context";
import { fontMono, tokens } from "@/lib/theme-tokens";

interface ListFilterBarProps {
  canFilter: boolean;
  isMine: boolean;
  cars: string[];
  carFilter: string;
  years: string[];
  yearFilter: string;
  onMineChange: (v: string) => void;
  onCarChange: (v: string) => void;
  onYearChange: (v: string) => void;
}

export function ListFilterBar({
  canFilter,
  isMine,
  cars,
  carFilter,
  years,
  yearFilter,
  onMineChange,
  onCarChange,
  onYearChange,
}: ListFilterBarProps) {
  const t = useT();
  const { theme } = useTheme();
  const mono = theme === "mono";

  const btnStyle = (active: boolean): React.CSSProperties =>
    mono
      ? {
          padding: "5px 11px",
          background: active ? tokens.ink : "transparent",
          color: active ? tokens.paper : tokens.inkDim,
          border: "none",
          borderRadius: "var(--radius-pill, 999px)",
          fontFamily: "var(--font-inter, 'Inter', system-ui, sans-serif)",
          fontSize: 11.5,
          fontWeight: 500,
          letterSpacing: 0,
          cursor: "pointer",
          transition: "background 0.15s",
        }
      : {
          padding: "5px 12px",
          background: active ? tokens.ink : "transparent",
          color: active ? tokens.paper : tokens.inkDim,
          border: `1.5px solid ${tokens.ink}`,
          fontFamily: fontMono,
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: 2,
          textTransform: "uppercase",
          cursor: "pointer",
        };

  const pillGroup: React.CSSProperties = mono
    ? {
        display: "inline-flex",
        alignSelf: "flex-start",
        border: `1px solid ${tokens.paperDark}`,
        borderRadius: "var(--radius-pill, 999px)",
        padding: 2,
        gap: 1,
      }
    : { display: "flex", gap: 0 };

  if (!canFilter && years.length <= 1 && cars.length <= 1) return null;

  return (
    <div
      style={{
        padding: "10px 16px 8px",
        borderBottom: mono ? "none" : `1px solid ${tokens.paperDark}`,
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      {(canFilter || years.length > 1) && (
        <div style={{ display: "flex", alignItems: "center" }}>
          {canFilter && (
            <div style={pillGroup}>
              {(["all", "mine"] as const).map((v, i, arr) => (
                <button
                  key={v}
                  onClick={() => onMineChange(v === "mine" ? "true" : "")}
                  style={{
                    ...btnStyle(v === "mine" ? isMine : !isMine),
                    ...(mono
                      ? {}
                      : { borderRight: i < arr.length - 1 ? "none" : `1.5px solid ${tokens.ink}` }),
                  }}
                >
                  {v === "all" ? t("filter.all") : t("filter.mine")}
                </button>
              ))}
            </div>
          )}
          {years.length > 1 && (
            <div style={{ marginLeft: "auto" }}>
              <YearSelect
                value={yearFilter}
                onChange={onYearChange}
                years={years}
                allLabel={t("filter.all")}
              />
            </div>
          )}
        </div>
      )}
      {cars.length > 1 && (
        <div style={pillGroup}>
          {[null, ...cars].map((car, i, arr) => (
            <button
              key={car ?? "__all"}
              onClick={() => onCarChange(car ?? "")}
              style={{
                ...btnStyle(carFilter === (car ?? "")),
                ...(mono
                  ? {}
                  : { borderRight: i < arr.length - 1 ? "none" : `1.5px solid ${tokens.ink}` }),
              }}
            >
              {car ?? t("filter.all")}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
