import { getFuelFillups, insertFuelFillup } from "@/lib/queries/fuel-fillups";
import { fuelFillupSchema } from "@/lib/schemas/fuel-fillup";
import { listHandler, createHandler } from "@/lib/api/crud-handler";

export const GET = listHandler(getFuelFillups);
export const POST = createHandler(fuelFillupSchema, insertFuelFillup);
