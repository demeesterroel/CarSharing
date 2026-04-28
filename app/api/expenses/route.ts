import { getExpenses, insertExpense } from "@/lib/queries/expenses";
import { expenseSchema } from "@/lib/schemas/expense";
import { listHandler, createHandler } from "@/lib/api/crud-handler";

export const GET = listHandler(getExpenses);
export const POST = createHandler(expenseSchema, insertExpense);
