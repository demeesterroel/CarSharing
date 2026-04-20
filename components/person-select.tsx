"use client";
import type { Person } from "@/types";
import { t } from "@/lib/i18n";

interface Props {
  people: Person[];
  value: number | null;
  onChange: (personId: number) => void;
  placeholder?: string;
}

export function PersonSelect({ people, value, onChange, placeholder }: Props) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <option value="" disabled>{placeholder ?? t("form.select_person_placeholder")}</option>
      {people.map((p) => (
        <option key={p.id} value={p.id}>{p.name}</option>
      ))}
    </select>
  );
}
