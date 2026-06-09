import { json, notFound, readBody, readId, requireCanEdit } from "@/lib/api";
import { getOneHandler } from "@/lib/api/crud-handler";
import { getDb } from "@/lib/db";
import { notifyAdminOfChange } from "@/lib/notify-admin";
import {
  ConflictError,
  deleteExpense,
  getExpenseById,
  updateExpense,
} from "@/lib/queries/expenses";
import { expenseSchema } from "@/lib/schemas/expense";
import { NextResponse } from "next/server";

export const GET = getOneHandler(getExpenseById);

export const PUT = json(async (req: Request, ctx) => {
  const id = await readId(ctx);
  const db = getDb();
  const existing = getExpenseById(db, id);
  if (!existing) notFound();
  const session = await requireCanEdit(req, existing, db);
  const data = await readBody(req, expenseSchema);
  const expectedUpdatedAt = req.headers.get("X-Expected-Updated-At") ?? undefined;
  try {
    updateExpense(db, id, data, { expectedUpdatedAt });
    notifyAdminOfChange({
      db,
      actor: session,
      action: "updated",
      entity: "expense",
      details: [
        `Expense ID: ${id}`,
        `Date: ${data.date}`,
        `Car ID: ${data.car_id}`,
        `Amount: €${data.amount}`,
        ...(data.description ? [`Description: ${data.description}`] : []),
        ...(data.category ? [`Category: ${data.category}`] : []),
      ].join("\n"),
    }).catch(() => {});
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
  const session = await requireCanEdit(req, existing, db);
  deleteExpense(db, id);
  notifyAdminOfChange({
    db,
    actor: session,
    action: "deleted",
    entity: "expense",
    details: [
      `Expense ID: ${id}`,
      `Date: ${existing.date}`,
      `Car ID: ${existing.car_id}`,
      `Amount: €${existing.amount}`,
      ...(existing.description ? [`Description: ${existing.description}`] : []),
      ...(existing.category ? [`Category: ${existing.category}`] : []),
    ].join("\n"),
  }).catch(() => {});
  return NextResponse.json({ deleted: true });
});
