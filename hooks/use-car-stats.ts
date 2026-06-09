import { apiFetch } from "@/lib/api/client";
import { useQuery } from "@tanstack/react-query";
import type { CarStats } from "@/lib/queries/cars";

export function useCarStats(carId: number, year: number) {
  return useQuery<CarStats>({
    queryKey: ["car-stats", carId, year],
    queryFn: () => apiFetch(`/api/vehicles/${carId}/stats?year=${year}`),
  });
}
