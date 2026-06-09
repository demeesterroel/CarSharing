import { apiFetch } from "@/lib/api/client";
import type { CarState } from "@/types";
import { useQuery } from "@tanstack/react-query";

export function useLastCarState(carId: number | undefined) {
  return useQuery<CarState | null>({
    queryKey: ["car-state", carId],
    enabled: Boolean(carId),
    queryFn: () => apiFetch<CarState | null>(`/api/vehicles/${carId}/last-state`),
  });
}
