import { createResourceHooks } from "./use-resource";
import type { Expense, ExpenseInput } from "@/types";

export const expensesHooks = createResourceHooks<Expense, ExpenseInput>(
  "expenses",
  "/api/expenses",
  { invalidate: [["dashboard"]] }
);

export const useExpenses = expensesHooks.useList;
export const useCreateExpense = expensesHooks.useCreate;
export const useUpdateExpense = expensesHooks.useUpdate;
export const useDeleteExpense = expensesHooks.useDelete;
