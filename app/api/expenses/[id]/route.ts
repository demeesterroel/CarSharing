import { z } from "zod";
import { getDb } from "@/lib/db";
import { getExpenseById, updateExpense, deleteExpense } from "@/lib/queries/expenses";
import { json, readBody, readId, notFound } from "@/lib/api";

const ExpenseSchema = z.object({
  person_id: z.number().int().positive(),
  car_id: z.number().int().positive(),
  date: z.string().min(10),
  amount: z.number().positive(),
  description: z.string().nullable().optional().transform((v) => v ?? null),
  category: z.string().nullable().optional().transform((v) => v ?? null),
});

export const GET = json(async (_req, ctx) => {
  const id = await readId(ctx);
  const row = getExpenseById(getDb(), id);
  if (!row) notFound();
  return row;
});

export const PUT = json(async (req, ctx) => {
  const id = await readId(ctx);
  const body = await readBody(req, ExpenseSchema);
  updateExpense(getDb(), id, body as any);
  return { ok: true };
});

export const DELETE = json(async (_req, ctx) => {
  const id = await readId(ctx);
  deleteExpense(getDb(), id);
  return { ok: true };
});
