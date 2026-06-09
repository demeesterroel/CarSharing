import { createResourceHooks } from "./use-resource";
import type { CarStats } from "@/lib/queries/cars";

const hooks = createResourceHooks<CarStats, { carId: number; year: number }>(
  "car-stats",
  "/api/vehicles", // This path is a bit tricky with the dynamic part, but createResourceHooks expects a base path.
  // Actually, the current implementation of createResourceHooks doesn't support dynamic segments like [id] well for useList, but it's fine for useQuery if we use it manually or extend it.
  // Let's just use useQuery directly for the stats to avoid fighting the existing pattern if it's not built for it.
);

// Since createResourceHooks is a bit rigid, I'll implement a custom one for stats.
// It will use apiFetch under the hood.
import { apiFetch } from "@/lib/api/client";
import { useQuery } from "@tanstack/react-query";

export function useCarStats(carId: number, year: number) {
  return useQuery<CarStats>({
    queryKey: ["car-stats", carId, year],
    queryFn: () => apiFetch(`/api/vehicles/${carId}/stats?year=${year}`),
  });
}
