import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getExpenses, insertExpense } from "@/lib/queries/expenses";
import { json, readBody } from "@/lib/api";

const ExpenseSchema = z.object({
  person_id: z.number().int().positive(),
  car_id: z.number().int().positive(),
  date: z.string().min(10),
  amount: z.number().positive(),
  description: z.string().nullable().optional().transform((v) => v ?? null),
  category: z.string().nullable().optional().transform((v) => v ?? null),
});

export const GET = json(async () => getExpenses(getDb()));

export const POST = json(async (req) => {
  const body = await readBody(req, ExpenseSchema);
  const id = insertExpense(getDb(), body as any);
  return NextResponse.json({ id }, { status: 201 });
});
