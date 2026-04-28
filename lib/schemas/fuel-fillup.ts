import { z } from "zod";

export const fuelFillupSchema = z.object({
  person_id: z.number().int().positive(),
  car_id: z.number().int().positive(),
  date: z.string().min(10),
  amount: z.number().positive(),
  liters: z.number().positive(),
  full_tank: z.number().int().min(0).max(1).optional().default(0).transform((v) => v as 0 | 1),
  odometer: z.number().int().nonnegative().nullable().optional().transform((v) => v ?? null),
  receipt: z.string().nullable().optional().transform((v) => v ?? null),
  location: z.string().nullable().optional().transform((v) => v ?? null),
  gps_coords: z.string().nullable().optional().transform((v) => v ?? null),
});
