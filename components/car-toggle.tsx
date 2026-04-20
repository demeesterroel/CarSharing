"use client";
import type { Car } from "@/types";

interface Props {
  cars: Car[];
  value: number | null;
  onChange: (carId: number) => void;
}

export function CarToggle({ cars, value, onChange }: Props) {
  return (
    <div className="flex gap-2">
      {cars.map((car) => (
        <button
          key={car.id}
          type="button"
          onClick={() => onChange(car.id)}
          className={`px-4 py-2 rounded border text-sm font-medium transition-colors ${
            value === car.id
              ? "bg-blue-600 text-white border-blue-600"
              : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
          }`}
        >
          {car.short}
        </button>
      ))}
    </div>
  );
}
