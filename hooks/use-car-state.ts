import { useQuery } from "@tanstack/react-query";
import type { CarState } from "@/types";

export function useLastCarState(carId: number | undefined) {
  return useQuery<CarState | null>({
    queryKey: ["car-state", carId],
    enabled: Boolean(carId),
    queryFn: async () => {
      const res = await fetch(`/api/cars/${carId}/last-state`);
      if (!res.ok) throw new Error("Failed to load car state");
      return res.json();
    },
  });
}
