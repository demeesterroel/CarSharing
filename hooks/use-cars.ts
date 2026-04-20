import { createResourceHooks } from "./use-resource";
import type { Car, CarInput } from "@/types";

export const carsHooks = createResourceHooks<Car, CarInput>("cars", "/api/cars");
export const useCars = carsHooks.useList;
export const useCreateCar = carsHooks.useCreate;
export const useUpdateCar = carsHooks.useUpdate;
export const useDeleteCar = carsHooks.useDelete;
