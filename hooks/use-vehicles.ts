import type { Car } from "@/types";
import { createResourceHooks } from "./use-resource";

const hooks = createResourceHooks<Car, Omit<Car, "id">>("cars", "/api/vehicles", {
  invalidate: [["dashboard"]],
});
export const useCars = hooks.useList;
export const useCreateCar = hooks.useCreate;
export const useUpdateCar = hooks.useUpdate;
export const useDeleteCar = hooks.useDelete;
