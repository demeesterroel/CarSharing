"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { useDashboard } from "@/hooks/use-dashboard";
import { t } from "@/lib/i18n";

function balanceColor(balance: number) {
  if (balance > 0.005) return "text-green-600";
  if (balance < -0.005) return "text-red-600";
  return "text-gray-400";
}

function balanceDot(balance: number) {
  if (balance > 0.005) return "bg-green-500";
  if (balance < -0.005) return "bg-red-500";
  return "bg-gray-300";
}

function balanceMessage(balance: number): string {
  if (Math.abs(balance) < 0.005) return t("balance.settled");
  if (balance > 0) return t("balance.credit", { amount: balance.toFixed(2) });
  return t("balance.debt", { amount: Math.abs(balance).toFixed(2) });
}

export default function DashboardPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const { data: rows = [], isLoading } = useDashboard(year);

  return (
    <>
      <PageHeader title={t("page.dashboard")} />
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <button onClick={() => setYear((y) => y - 1)} className="p-1 rounded hover:bg-gray-100">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="font-semibold">{year}</span>
        <button
          onClick={() => setYear((y) => y + 1)}
          disabled={year >= currentYear}
          className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {isLoading ? (
        <p className="p-4 text-gray-500">{t("state.loading")}</p>
      ) : (
        <div className="divide-y">
          {rows.map((row) => (
            <div key={row.person_id} className="flex items-center px-4 py-3 gap-3">
              <span
                className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${balanceDot(row.balance)}`}
              />
              <span
                className={`flex-1 text-sm font-medium ${
                  row.balance !== 0 ? balanceColor(row.balance) : "text-gray-500"
                }`}
              >
                {row.person_name}
              </span>
              <div className="text-right">
                <p className={`text-sm font-mono font-medium ${balanceColor(row.balance)}`}>
                  € {row.balance.toFixed(2)}
                </p>
                <p className="text-xs text-gray-400">{balanceMessage(row.balance)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
