import { useQuery } from "@tanstack/react-query";
import type { CarState } from "@/types";
import { apiFetch } from "@/lib/api/client";

export function useLastCarState(carId: number | undefined) {
  return useQuery<CarState | null>({
    queryKey: ["car-state", carId],
    enabled: Boolean(carId),
    queryFn: () => apiFetch<CarState | null>(`/api/cars/${carId}/last-state`),
  });
}
