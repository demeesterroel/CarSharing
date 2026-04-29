import { z } from "zod";

export const tripSchema = z.object({
  person_id: z.number().int().positive(),
  car_id: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_odometer: z.number().int().nonnegative(),
  end_odometer: z.number().int().nonnegative(),
  location: z
    .string()
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  parking: z
    .string()
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  gps_coords: z
    .string()
    .nullable()
    .optional()
    .transform((v) => v ?? null),
});
