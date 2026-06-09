"use client";
import { fontMono, fontSerif, tokens } from "@/lib/theme-tokens";
import { useTheme } from "@/lib/theme-context";
import type { Car } from "@/types";

interface Props {
  cars: Car[];
  value: number | null;
  onChange: (carId: number) => void;
}

export function CarToggle({ cars, value, onChange }: Props) {
  const { theme } = useTheme();
  const visible = cars.filter((c) => c.active === 1 || c.id === value);

  if (theme === "mono") {
    return (
      <div
        style={{
          display: "flex",
          margin: "8px 14px 4px",
          border: `1px solid ${tokens.paperDark}`,
          borderRadius: "var(--radius-pill, 999px)",
          padding: 2,
          gap: 1,
        }}
      >
        {visible.map((car) => {
          const selected = value === car.id;
          return (
            <button
              key={car.id}
              type="button"
              onClick={() => onChange(car.id)}
              style={{
                flex: 1,
                padding: "8px 12px",
                background: selected ? tokens.ink : "transparent",
                color: selected ? tokens.paper : tokens.inkDim,
                border: "none",
                borderRadius: "var(--radius-pill, 999px)",
                cursor: "pointer",
                textAlign: "center",
                fontFamily: "var(--font-inter, 'Inter', system-ui, sans-serif)",
                fontSize: 13,
                fontWeight: 500,
                transition: "background 0.15s",
              }}
            >
              {car.name}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", width: "100%", borderBottom: `1.5px solid ${tokens.ink}` }}>
      {visible.map((car, i) => {
        const selected = value === car.id;
        return (
          <button
            key={car.id}
            type="button"
            onClick={() => onChange(car.id)}
            style={{
              flex: 1,
              padding: "12px 8px",
              background: selected ? tokens.ink : "transparent",
              color: selected ? tokens.paper : tokens.inkDim,
              border: "none",
              borderRight: i < visible.length - 1 ? `1.5px dashed ${tokens.inkMute}` : "none",
              cursor: "pointer",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontFamily: fontMono,
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: 3,
                textTransform: "uppercase",
                color: selected ? tokens.paper : tokens.ink,
              }}
            >
              {car.short}
            </div>
            <div
              style={{
                fontFamily: fontSerif,
                fontSize: 11,
                fontWeight: 400,
                color: selected ? tokens.paperDark : tokens.inkMute,
                marginTop: 2,
              }}
            >
              {car.name}
            </div>
          </button>
        );
      })}
    </div>
  );
}
