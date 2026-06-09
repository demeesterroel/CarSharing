import { apiFetch } from "@/lib/api/client";
import { useQuery } from "@tanstack/react-query";
import type { CarStats } from "@/types";

export function useCarStats(carId: number | undefined, year: number) {
  return useQuery<CarStats | null>({
    queryKey: ["car-stats", carId, year],
    enabled: Boolean(carId),
    queryFn: () => apiFetch<CarStats>(`/api/vehicles/${carId}/stats?year=${year}`),
  });
}
