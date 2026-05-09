import { z } from "zod";

export const carSchema = z.object({
  short: z.string().min(1).max(10),
  name: z.string().min(1),
  price_per_km: z.number().positive(),
  brand: z
    .string()
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  color: z
    .string()
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  owner_name: z
    .string()
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  owner_person_id: z
    .number()
    .int()
    .positive()
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  long_threshold: z.number().int().positive().optional().default(500),
  active: z.number().int().min(0).max(1).optional().default(1),
  expected_km: z
    .number()
    .int()
    .positive()
    .nullable()
    .optional()
    .transform((v) => v ?? null),
});

export const ownerCarPatchSchema = z.object({
  name: z.string().min(1),
  price_per_km: z.number().positive(),
  active: z.number().int().min(0).max(1).optional(),
});
