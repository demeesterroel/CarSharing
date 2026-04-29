import { getCarById, updateCar } from "@/lib/queries/cars";
import { carSchema } from "@/lib/schemas/car";
import { getDb } from "@/lib/db";
import { json, readBody, readId, notFound, requireAdmin } from "@/lib/api";

export const GET = json(async (_req, ctx) => {
  const car = getCarById(getDb(), await readId(ctx));
  if (!car) notFound();
  return car;
});

export const PUT = json(async (req, ctx) => {
  await requireAdmin(req);
  const id = await readId(ctx);
  const data = await readBody(req, carSchema);
  updateCar(getDb(), id, data);
  return { ok: true };
});
