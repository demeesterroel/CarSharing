"use client";
import { Plus } from "lucide-react";
import { t } from "@/lib/i18n";

interface Props {
  onClick: () => void;
  label?: string;
}

export function Fab({ onClick, label }: Props) {
  return (
    <button
      onClick={onClick}
      aria-label={label ?? t("action.add")}
      className="fixed bottom-20 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-blue-700 transition-colors z-20"
    >
      <Plus className="w-6 h-6" />
    </button>
  );
}
