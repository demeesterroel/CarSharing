import { z } from "zod";

export const paymentSchema = z.object({
  person_id: z.number().int().positive(),
  date: z.string().min(10),
  amount: z.number().refine((n) => n !== 0),
  note: z
    .string()
    .nullable()
    .optional()
    .transform((v) => v ?? null),
});
