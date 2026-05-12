import { NextResponse } from "next/server";
import {
  getExpenseById,
  updateExpense,
  deleteExpense,
  ConflictError,
} from "@/lib/queries/expenses";
import { expenseSchema } from "@/lib/schemas/expense";
import { getOneHandler } from "@/lib/api/crud-handler";
import { json, readBody, readId, notFound, requireCanEdit } from "@/lib/api";
import { getDb } from "@/lib/db";

export const GET = getOneHandler(getExpenseById);

export const PUT = json(async (req: Request, ctx) => {
  const id = await readId(ctx);
  const db = getDb();
  const existing = getExpenseById(db, id);
  if (!existing) notFound();
  await requireCanEdit(req, existing, db);
  const data = await readBody(req, expenseSchema);
  const expectedUpdatedAt = req.headers.get("X-Expected-Updated-At") ?? undefined;
  try {
    updateExpense(db, id, data, { expectedUpdatedAt });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ConflictError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    throw e;
  }
});

export const DELETE = json(async (req: Request, ctx) => {
  const id = await readId(ctx);
  const db = getDb();
  const existing = getExpenseById(db, id);
  if (!existing) notFound();
  await requireCanEdit(req, existing, db);
  deleteExpense(db, id);
  return NextResponse.json({ deleted: true });
});
