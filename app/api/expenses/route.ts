import { NextResponse } from "next/server";
import { getExpenses, getExpenseById, insertExpense } from "@/lib/queries/expenses";
import { expenseSchema } from "@/lib/schemas/expense";
import { listHandler } from "@/lib/api/crud-handler";
import { json } from "@/lib/api";
import { getDb } from "@/lib/db";

export const GET = listHandler(getExpenses);

export const POST = json(async (req: Request) => {
  const raw = await req.json();
  const data = expenseSchema.parse(raw);
  const client_id = typeof raw.client_id === "string" ? raw.client_id : null;
  const db = getDb();
  const id = insertExpense(db, { ...data, client_id });
  return NextResponse.json(getExpenseById(db, id), { status: 201 });
});
