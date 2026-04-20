import { createResourceHooks } from "./use-resource";
import type { FuelFillup, FuelFillupInput } from "@/types";

export const fuelFillupsHooks = createResourceHooks<FuelFillup, FuelFillupInput>(
  "fuel-fillups",
  "/api/fuel",
  { invalidate: [["dashboard"], ["car-state"]] }
);

export const useFuelFillups = fuelFillupsHooks.useList;
export const useCreateFuelFillup = fuelFillupsHooks.useCreate;
export const useUpdateFuelFillup = fuelFillupsHooks.useUpdate;
export const useDeleteFuelFillup = fuelFillupsHooks.useDelete;
