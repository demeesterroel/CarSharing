import { getDb } from "@/lib/db";
import { getCarById, updateCar } from "@/lib/queries/cars";
import { json, readBody, readId, notFound } from "@/lib/api";
import { carSchema } from "@/lib/schemas/car";

export const GET = json(async (_req, ctx) => {
  const car = getCarById(getDb(), await readId(ctx));
  if (!car) notFound();
  return car;
});

export const PUT = json(async (req, ctx) => {
  const id = await readId(ctx);
  const data = await readBody(req, carSchema);
  updateCar(getDb(), id, data);
  return { ok: true };
});
