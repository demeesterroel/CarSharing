"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import { newUuid } from "@/lib/offline/uuid";
import { enqueue } from "@/lib/offline/outbox";
import {
  applyCreate,
  replaceCreate,
  rollbackCreate,
  applyUpdate,
  applyDelete,
} from "@/lib/offline/optimistic";
import type { Expense, ExpenseInput } from "@/types";

const QUERY_KEY = "expenses";
const PATH = "/api/expenses";
const INVALIDATE = [["dashboard"]];

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: [QUERY_KEY] });
  for (const k of INVALIDATE) qc.invalidateQueries({ queryKey: k });
}

function getCsrfToken(): string {
  return document.cookie.match(/csrf-token=([^;]+)/)?.[1] ?? "";
}

export function useExpenses() {
  return useQuery<Expense[]>({
    queryKey: [QUERY_KEY],
    queryFn: () => apiFetch<Expense[]>(PATH),
  });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation<Expense, Error, ExpenseInput>({
    mutationFn: async (input: ExpenseInput): Promise<Expense> => {
      const client_id = newUuid();
      const optimistic: Expense = {
        id: -Date.now(),
        client_id,
        person_id: input.person_id,
        car_id: input.car_id,
        date: input.date,
        amount: input.amount,
        description: input.description ?? null,
        category: input.category ?? null,
        settled_outside: input.settled_outside ?? 0,
        updated_at: new Date().toISOString(),
      };
      applyCreate<Expense>(qc, [QUERY_KEY], optimistic);

      try {
        const res = await fetch(PATH, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-csrf-token": getCsrfToken() },
          body: JSON.stringify({ ...input, client_id }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const server = (await res.json()) as Expense;
        replaceCreate<Expense>(qc, [QUERY_KEY], client_id, server);
        invalidateAll(qc);
        return server;
      } catch {
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          await enqueue({
            url: PATH,
            method: "POST",
            body: { ...input, client_id },
            resource: "expenses",
            client_id,
          });
          return optimistic;
        }
        rollbackCreate<Expense>(qc, [QUERY_KEY], client_id);
        throw new Error("Failed to create expense");
      }
    },
  });
}

export function useUpdateExpense() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, ExpenseInput & { id: number }>({
    mutationFn: async ({ id, ...input }) => {
      const existing = qc.getQueryData<Expense[]>([QUERY_KEY])?.find((e) => e.id === id);
      applyUpdate<Expense>(qc, [QUERY_KEY], id, input as Partial<Expense>);

      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "x-csrf-token": getCsrfToken(),
        };
        if (existing?.updated_at) headers["X-Expected-Updated-At"] = existing.updated_at;
        const res = await fetch(`${PATH}/${id}`, {
          method: "PUT",
          headers,
          body: JSON.stringify(input),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        invalidateAll(qc);
        return res.json();
      } catch {
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          await enqueue({
            url: `${PATH}/${id}`,
            method: "PUT",
            body: input,
            resource: "expenses",
            resource_id: id,
            expectedUpdatedAt: existing?.updated_at,
          });
          return {};
        }
        if (existing) applyUpdate<Expense>(qc, [QUERY_KEY], id, existing);
        throw new Error("Failed to update expense");
      }
    },
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, number>({
    mutationFn: async (id: number) => {
      applyDelete<Expense>(qc, [QUERY_KEY], id);

      try {
        const res = await fetch(`${PATH}/${id}`, {
          method: "DELETE",
          headers: { "x-csrf-token": getCsrfToken() },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        invalidateAll(qc);
        return res.json();
      } catch {
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          await enqueue({
            url: `${PATH}/${id}`,
            method: "DELETE",
            body: null,
            resource: "expenses",
            resource_id: id,
          });
          return {};
        }
        invalidateAll(qc);
        throw new Error("Failed to delete expense");
      }
    },
  });
}

export const expensesHooks = {
  useList: useExpenses,
  useCreate: useCreateExpense,
  useUpdate: useUpdateExpense,
  useDelete: useDeleteExpense,
};
