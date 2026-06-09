import { json, requireSession } from "@/lib/api";
import { listHandler } from "@/lib/api/crud-handler";
import { getDb } from "@/lib/db";
import { notifyAdminOfChange } from "@/lib/notify-admin";
import { getExpenseById, getExpenses, insertExpense } from "@/lib/queries/expenses";
import { expenseSchema } from "@/lib/schemas/expense";
import { NextResponse } from "next/server";

export const GET = listHandler(getExpenses);

export const POST = json(async (req: Request) => {
  const session = await requireSession(req);
  const raw = await req.json();
  const data = expenseSchema.parse(raw);
  const client_id = typeof raw.client_id === "string" ? raw.client_id : null;
  const db = getDb();
  const id = insertExpense(db, { ...data, client_id });
  const expense = getExpenseById(db, id);
  notifyAdminOfChange({
    db,
    actor: session,
    action: "created",
    entity: "expense",
    details: [
      `Date: ${data.date}`,
      `Car ID: ${data.car_id}`,
      `Amount: €${data.amount}`,
      ...(data.description ? [`Description: ${data.description}`] : []),
      ...(data.category ? [`Category: ${data.category}`] : []),
    ].join("\n"),
  }).catch(() => {});
  return NextResponse.json(expense, { status: 201 });
});
