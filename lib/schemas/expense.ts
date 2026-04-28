import { z } from "zod";

const expenseCategorySchema = z
  .enum(["onderhoud", "keuring", "belasting", "verzekering", "diversen"])
  .nullable()
  .optional()
  .transform((v) => v ?? null);

export const expenseSchema = z.object({
  person_id: z.number().int().positive(),
  car_id: z.number().int().positive(),
  date: z.string().min(10),
  amount: z.number().positive(),
  description: z.string().nullable().optional().transform((v) => v ?? null),
  category: expenseCategorySchema,
});
