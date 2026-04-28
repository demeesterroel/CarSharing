import { getCarById, updateCar } from "@/lib/queries/cars";
import { carSchema } from "@/lib/schemas/car";
import { getOneHandler, updateHandler } from "@/lib/api/crud-handler";

export const GET = getOneHandler(getCarById);
export const PUT = updateHandler(carSchema, updateCar);
