import { useQuery } from "@tanstack/react-query";
import type { DashboardRow } from "@/types";
import { apiFetch } from "@/lib/api/client";

export function useDashboard(year: number) {
  return useQuery<DashboardRow[]>({
    queryKey: ["dashboard", year],
    queryFn: () => apiFetch<DashboardRow[]>(`/api/dashboard?year=${year}`),
  });
}

export function useEarliestDashboardYear() {
  return useQuery<number>({
    queryKey: ["dashboard-earliest-year"],
    queryFn: async () => {
      const data = await apiFetch<{ year: number }>("/api/dashboard/earliest-year");
      return data.year;
    },
    staleTime: Infinity,
  });
}
