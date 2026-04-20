import { createResourceHooks } from "./use-resource";
import type { Trip, TripInput } from "@/types";

export const tripsHooks = createResourceHooks<Trip, TripInput>("trips", "/api/trips", {
  invalidate: [["dashboard"]],
});
export const useTrips = tripsHooks.useList;
export const useCreateTrip = tripsHooks.useCreate;
export const useUpdateTrip = tripsHooks.useUpdate;
export const useDeleteTrip = tripsHooks.useDelete;
