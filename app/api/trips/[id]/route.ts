import { getTripById, updateTrip, deleteTrip } from "@/lib/queries/trips";
import { tripSchema } from "@/lib/schemas/trip";
import { getOneHandler, updateHandler, deleteHandler } from "@/lib/api/crud-handler";

export const GET = getOneHandler(getTripById);
export const PUT = updateHandler(tripSchema, updateTrip);
export const DELETE = deleteHandler(deleteTrip);
