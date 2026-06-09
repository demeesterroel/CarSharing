import { apiFetch } from "@/lib/api/client";
import type { CarStats } from "@/lib/queries/cars";
import { useQuery } from "@tanstack/react-query";

export function useCarStats(carId: number | null, year: number) {
  return useQuery<CarStats>({
    queryKey: ["car-stats", carId, year],
    queryFn: () => apiFetch<CarStats>(`/api/cars/${carId}/stats?year=${year}`),
    enabled: carId !== null,
  });
}
