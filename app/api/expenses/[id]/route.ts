import { getExpenseById, updateExpense, deleteExpense } from "@/lib/queries/expenses";
import { expenseSchema } from "@/lib/schemas/expense";
import { getOneHandler, updateHandler, deleteHandler } from "@/lib/api/crud-handler";

export const GET = getOneHandler(getExpenseById);
export const PUT = updateHandler(expenseSchema, updateExpense);
export const DELETE = deleteHandler(deleteExpense);
