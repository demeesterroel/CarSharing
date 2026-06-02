import { getCarById, updateCar, deleteCar, carHasHistory } from "@/lib/queries/cars";
import { carSchema, ownerCarPatchSchema } from "@/lib/schemas/car";
import { getDb } from "@/lib/db";
import {
  json,
  readBody,
  readId,
  notFound,
  forbidden,
  conflict,
  requireAdminOrOwner,
  requireSession,
} from "@/lib/api";

export const GET = json(async (req, ctx) => {
  await requireSession(req);
  const car = getCarById(getDb(), await readId(ctx));
  if (!car) notFound();
  return car;
});

export const PUT = json(async (req, ctx) => {
  const session = await requireAdminOrOwner(req);
  const id = await readId(ctx);
  const db = getDb();

  if (!session.isAdmin) {
    const current = getCarById(db, id);
    if (!current || current.owner_person_id !== session.personId) forbidden();
    const patch = await readBody(req, ownerCarPatchSchema);
    updateCar(db, id, {
      short: current.short,
      name: patch.name,
      price_per_km: patch.price_per_km,
      brand: current.brand,
      color: current.color,
      owner_person_id: current.owner_person_id,
      long_threshold: current.long_threshold,
      active: patch.active ?? current.active,
      expected_km: current.expected_km,
    });
    return { ok: true };
  }

  const data = await readBody(req, carSchema);
  updateCar(db, id, data);
  return { ok: true };
});

export const DELETE = json(async (req, ctx) => {
  const session = await requireAdminOrOwner(req);
  const id = await readId(ctx);
  const db = getDb();
  const car = getCarById(db, id);
  if (!car) notFound();
  if (!session.isAdmin && car.owner_person_id !== session.personId) forbidden();
  if (carHasHistory(db, id)) conflict("Car has reservations or trips — deactivate instead");
  deleteCar(db, id);
  return { ok: true };
});
