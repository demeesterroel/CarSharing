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
  description: z
    .string()
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  category: expenseCategorySchema,
  settled_outside: z
    .number()
    .int()
    .min(0)
    .max(1)
    .optional()
    .default(0)
    .transform((v) => v as 0 | 1),
});
