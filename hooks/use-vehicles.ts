import type { Car } from "@/types";
import type { CarStats } from "@/lib/queries/cars";
import { createResourceHooks } from "./use-resource";

const hooks = createResourceHooks<Car, Omit<Car, "id">>("cars", "/api/vehicles", {
  invalidate: [["dashboard"]],
});
export const useCars = hooks.useList;
export const useCreateCar = hooks.useCreate;
export const useUpdateCar = hooks.useUpdate;
export const useDeleteCar = hooks.useDelete;

export function useCarStats(carId: number | null) {
  return useQuery<{ year: number; tripCount: number; totalKm: number; totalFuelLiters: number; totalFuelCost: number; avgConsumptionLper100km: number | null; avgFuelCostPerKm: number | null }>({
    queryKey: ["car-stats", carId],
    queryFn: async () => {
      if (!carId) return null;
      const res = await fetch(`/api/vehicles/${carId}/stats`);
      if (!res.ok) throw new Error("Failed to load car stats");
      return res.json();
    },
    enabled: carId !== null,
  });
}
