import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getExpenses, insertExpense } from "@/lib/queries/expenses";
import { json, readBody } from "@/lib/api";
import { expenseSchema } from "@/lib/schemas/expense";

export const GET = json(async () => getExpenses(getDb()));

export const POST = json(async (req) => {
  const body = await readBody(req, expenseSchema);
  const id = insertExpense(getDb(), body as any);
  return NextResponse.json({ id }, { status: 201 });
});
