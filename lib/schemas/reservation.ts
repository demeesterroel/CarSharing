import { z } from "zod";

export const reservationSchema = z
  .object({
    person_id: z.number().int().positive(),
    car_id: z.number().int().positive(),
    start_date: z.string().min(10),
    end_date: z.string().min(10),
    note: z
      .string()
      .nullable()
      .optional()
      .transform((v) => v ?? null),
    status: z.enum(["pending", "confirmed", "rejected"]).optional(),
  })
  .refine((v) => v.end_date >= v.start_date, {
    message: "end_date must be on or after start_date",
    path: ["end_date"],
  });

export const reservationStatusSchema = z.object({
  status: z.enum(["pending", "confirmed", "rejected"]),
});
