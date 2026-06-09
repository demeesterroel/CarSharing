import type { Car } from "@/types";
import { createResourceHooks } from "./use-resource";
import { useQuery } from "@tanstack/react-query";

const hooks = createResourceHooks<Car, Omit<Car, "id">>("cars", "/api/vehicles", {
  invalidate: [["dashboard"]],
});
export const useCars = hooks.useList;
export const useCreateCar = hooks.useCreate;
export const useUpdateCar = hooks.useUpdate;
export const useDeleteCar = hooks.useDelete;

export function useCarStats(carId: number, year: number) {
  return useQuery({
    queryKey: ["car-stats", carId, year],
    queryFn: async () => {
      const response = await fetch(`/api/cars/stats?carId=${carId}&year=${year}`);
      if (!response.ok) {
        throw new Error("Failed to fetch car stats");
      }
      return response.json();
    },
  });
}
