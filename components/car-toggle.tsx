"use client";
import type { Car } from "@/types";
import { paper, fontMono, fontSerif } from "@/lib/paper-theme";

interface Props {
  cars: Car[];
  value: number | null;
  onChange: (carId: number) => void;
}

export function CarToggle({ cars, value, onChange }: Props) {
  const visible = cars.filter((c) => c.active === 1 || c.id === value);
  return (
    <div style={{ display: "flex", width: "100%", borderBottom: `1.5px solid ${paper.ink}` }}>
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
              background: selected ? paper.ink : "transparent",
              color: selected ? paper.paper : paper.inkDim,
              border: "none",
              borderRight: i < visible.length - 1 ? `1.5px dashed ${paper.inkMute}` : "none",
              cursor: "pointer",
              textAlign: "center",
            }}
          >
            <div style={{
              fontFamily: fontMono, fontSize: 13, fontWeight: 700,
              letterSpacing: 3, textTransform: "uppercase",
              color: selected ? paper.paper : paper.ink,
            }}>
              {car.short}
            </div>
            <div style={{
              fontFamily: fontSerif, fontSize: 11, fontWeight: 400,
              color: selected ? paper.paperDark : paper.inkMute,
              marginTop: 2,
            }}>
              {car.name}
            </div>
          </button>
        );
      })}
    </div>
  );
}
