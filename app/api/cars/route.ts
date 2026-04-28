import { getCars, insertCar } from "@/lib/queries/cars";
import { carSchema } from "@/lib/schemas/car";
import { listHandler, createHandler } from "@/lib/api/crud-handler";

export const GET = listHandler(getCars);
export const POST = createHandler(carSchema, insertCar);
