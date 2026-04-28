import { getTrips, insertTrip } from "@/lib/queries/trips";
import { tripSchema } from "@/lib/schemas/trip";
import { listHandler, createHandler } from "@/lib/api/crud-handler";

export const GET = listHandler(getTrips);
export const POST = createHandler(tripSchema, insertTrip);
