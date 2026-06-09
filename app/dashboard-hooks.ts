// Re-export mutation hooks for the dashboard page
export { useCreateExpense, useDeleteExpense, useUpdateExpense } from "@/hooks/use-expenses";
export {
  useCreateFuelFillup,
  useDeleteFuelFillup,
  useUpdateFuelFillup,
} from "@/hooks/use-fuel-fillups";
export {
  useCreateReservation,
  useDeleteReservation,
  useUpdateReservation,
} from "@/hooks/use-reservations";
export { useCreateTrip, useDeleteTrip, useUpdateTrip } from "@/hooks/use-trips";
