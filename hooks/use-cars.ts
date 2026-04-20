import { createResourceHooks } from "./use-resource";
import type { Car } from "@/types";

const hooks = createResourceHooks<Car, Omit<Car, "id">>("cars", "/api/cars", {
  invalidate: [["dashboard"]],
});
export const useCars = hooks.useList;
export const useCreateCar = hooks.useCreate;
export const useUpdateCar = hooks.useUpdate;
