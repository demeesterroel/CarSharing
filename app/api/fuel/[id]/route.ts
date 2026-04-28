import { getFuelFillupById, updateFuelFillup, deleteFuelFillup } from "@/lib/queries/fuel-fillups";
import { fuelFillupSchema } from "@/lib/schemas/fuel-fillup";
import { getOneHandler, updateHandler, deleteHandler } from "@/lib/api/crud-handler";

export const GET = getOneHandler(getFuelFillupById);
export const PUT = updateHandler(fuelFillupSchema, updateFuelFillup);
export const DELETE = deleteHandler(deleteFuelFillup);
