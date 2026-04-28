import { getDb } from "@/lib/db";
import { getExpenseById, updateExpense, deleteExpense } from "@/lib/queries/expenses";
import { json, readBody, readId, notFound } from "@/lib/api";
import { expenseSchema } from "@/lib/schemas/expense";

export const GET = json(async (_req, ctx) => {
  const id = await readId(ctx);
  const row = getExpenseById(getDb(), id);
  if (!row) notFound();
  return row;
});

export const PUT = json(async (req, ctx) => {
  const id = await readId(ctx);
  const body = await readBody(req, expenseSchema);
  updateExpense(getDb(), id, body as any);
  return { ok: true };
});

export const DELETE = json(async (_req, ctx) => {
  const id = await readId(ctx);
  deleteExpense(getDb(), id);
  return { ok: true };
});
