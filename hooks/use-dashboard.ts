import { useQuery } from "@tanstack/react-query";
import type { DashboardRow } from "@/types";

export function useDashboard(year: number) {
  return useQuery<DashboardRow[]>({
    queryKey: ["dashboard", year],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard?year=${year}`);
      if (!res.ok) throw new Error("Failed to load dashboard");
      return res.json();
    },
  });
}
