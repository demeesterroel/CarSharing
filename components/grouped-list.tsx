import React from "react";

interface GroupedListProps<T> {
  items: T[];
  getKey: (item: T) => string;
  getGroupLabel: (key: string) => string;
  getGroupTotal: (items: T[]) => number;
  renderItem: (item: T) => React.ReactNode;
}

export function GroupedList<T>({
  items,
  getKey,
  getGroupLabel,
  getGroupTotal,
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
            <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-t">
              <span className="text-sm font-medium text-gray-600">{getGroupLabel(key)}</span>
              <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full font-mono">
                {total.toLocaleString("nl-BE", { minimumFractionDigits: 2 })}
              </span>
            </div>
            {groupItems.map((item, i) => (
              <React.Fragment key={i}>{renderItem(item)}</React.Fragment>
            ))}
          </div>
        );
      })}
    </div>
  );
}
