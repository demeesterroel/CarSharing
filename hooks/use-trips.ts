import { createResourceHooks } from "./use-resource";
import type { Trip, TripInput } from "@/types";

const hooks = createResourceHooks<Trip, TripInput>("trips", "/api/trips", {
  invalidate: [["dashboard"], ["car-state"]],
});
export const useTrips = hooks.useList;
export const useCreateTrip = hooks.useCreate;
export const useUpdateTrip = hooks.useUpdate;
export const useDeleteTrip = hooks.useDelete;
