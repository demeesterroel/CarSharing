import React from "react";
import { paper, fontMono, fontSerif, fmtYearMonth } from "@/lib/paper-theme";

interface GroupedListProps<T> {
  items: T[];
  getKey: (item: T) => string;
  getGroupLabel: (key: string) => string;
  getGroupTotal: (items: T[]) => number;
  totalSuffix?: string;
  renderItem: (item: T) => React.ReactNode;
}

export function GroupedList<T>({
  items,
  getKey,
  getGroupLabel,
  getGroupTotal,
  totalSuffix = "€",
  renderItem,
}: GroupedListProps<T>) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = getKey(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  const sortedKeys = Array.from(groups.keys()).sort().reverse();

  return (
    <div>
      {sortedKeys.map((key) => {
        const groupItems = groups.get(key)!;
        const total = getGroupTotal(groupItems);
        return (
          <div key={key}>
            {/* Month header */}
            <div
              className="group-month-header"
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                padding: "14px 20px 6px",
                background: paper.paperDeep,
              }}
            >
              <span
                style={{
                  fontFamily: fontSerif,
                  fontSize: 19,
                  fontWeight: 650,
                  letterSpacing: "-0.022em",
                  color: paper.ink,
                }}
              >
                {getGroupLabel(key)}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-sans, var(--font-inter, 'Inter', system-ui, sans-serif))",
                  fontSize: 13,
                  color: paper.inkDim,
                  fontWeight: 500,
                }}
              >
                {totalSuffix === "€"
                  ? `€\u00a0${total.toLocaleString("nl-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : `${total.toLocaleString("nl-BE")} ${totalSuffix}`}
              </span>
            </div>
            <div style={{ padding: "8px 16px" }}>
              {groupItems.map((item, i) => (
                <React.Fragment key={i}>{renderItem(item)}</React.Fragment>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
