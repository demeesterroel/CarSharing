import { z } from "zod";
import { getDb } from "@/lib/db";
import { getPaymentById, updatePayment, deletePayment } from "@/lib/queries/payments";
import { json, readBody, readId, notFound } from "@/lib/api";

const PaymentSchema = z.object({
  person_id: z.number().int().positive(),
  date: z.string().min(10),
  amount: z.number().positive(),
  note: z.string().nullable().optional(),
});

export const GET = json(async (_req, ctx) => {
  const id = await readId(ctx);
  const row = getPaymentById(getDb(), id);
  if (!row) notFound();
  return row;
});

export const PUT = json(async (req, ctx) => {
  const id = await readId(ctx);
  const body = await readBody(req, PaymentSchema);
  updatePayment(getDb(), id, body);
  return { ok: true };
});

export const DELETE = json(async (_req, ctx) => {
  const id = await readId(ctx);
  deletePayment(getDb(), id);
  return { ok: true };
});
