import { createResourceHooks } from "./use-resource";
import type { Reservation, ReservationInput } from "@/types";

export const reservationsHooks = createResourceHooks<Reservation, ReservationInput>("reservations", "/api/reservations", {
  invalidate: [["dashboard"]],
});
export const useReservations = reservationsHooks.useList;
export const useCreateReservation = reservationsHooks.useCreate;
export const useUpdateReservation = reservationsHooks.useUpdate;
export const useDeleteReservation = reservationsHooks.useDelete;
