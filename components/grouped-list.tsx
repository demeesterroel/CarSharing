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
            <div style={{
              display: "flex", alignItems: "baseline", justifyContent: "space-between",
              padding: "10px 20px 6px",
              borderTop: `1.5px dashed ${paper.ink}`,
              background: paper.paperDeep,
            }}>
              <span style={{ fontFamily: fontSerif, fontSize: 16, fontWeight: 600, color: paper.ink }}>
                {getGroupLabel(key)}
              </span>
              <span style={{ fontFamily: fontMono, fontSize: 11, color: paper.inkDim, fontWeight: 600 }}>
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
