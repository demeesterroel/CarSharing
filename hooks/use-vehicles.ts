import { apiFetch } from "@/lib/api/client";
import type { CarStats } from "@/lib/queries/cars";
import type { Car } from "@/types";
import { useQuery } from "@tanstack/react-query";
import { createResourceHooks } from "./use-resource";

const hooks = createResourceHooks<Car, Omit<Car, "id">>("cars", "/api/vehicles", {
  invalidate: [["dashboard"]],
});
export const useCars = hooks.useList;
export const useCreateCar = hooks.useCreate;
export const useUpdateCar = hooks.useUpdate;
export const useDeleteCar = hooks.useDelete;

// Per-car efficiency & usage stats (#374)
export function useCarStats(carId: number, year?: number) {
  return useQuery<CarStats>({
    queryKey: ["car-stats", carId, year ?? "latest"],
    queryFn: () =>
      apiFetch<CarStats>(`/api/vehicles/${carId}/stats${year ? `?year=${year}` : ""}`),
    enabled: carId > 0,
  });
}
