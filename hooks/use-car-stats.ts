import { apiFetch } from "@/lib/api/client";
import { useQuery } from "@tanstack/react-query";
import type { CarStats } from "@/lib/queries/cars";

export function useCarStats(carId: number, year?: number) {
  const queryKey = ["car-stats", carId, year];
  
  return useQuery<CarStats>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (year) params.append("year", year.toString());
      
      const response = await apiFetch<CarStats>(`/api/vehicles/${carId}/stats?${params.toString()}`);
      return response;
    },
  });
}