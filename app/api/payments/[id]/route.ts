import { getDb } from "@/lib/db";
import { getPaymentById, updatePayment, deletePayment } from "@/lib/queries/payments";
import { json, readBody, readId, notFound } from "@/lib/api";
import { paymentSchema } from "@/lib/schemas/payment";

export const GET = json(async (_req, ctx) => {
  const id = await readId(ctx);
  const row = getPaymentById(getDb(), id);
  if (!row) notFound();
  return row;
});

export const PUT = json(async (req, ctx) => {
  const id = await readId(ctx);
  const body = await readBody(req, paymentSchema);
  updatePayment(getDb(), id, body);
  return { ok: true };
});

export const DELETE = json(async (_req, ctx) => {
  const id = await readId(ctx);
  deletePayment(getDb(), id);
  return { ok: true };
});
