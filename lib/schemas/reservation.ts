import { z } from "zod";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

const timeField = z
  .string()
  .regex(HHMM, "time must be HH:MM")
  .nullable()
  .optional()
  .transform((v) => v ?? null);

export const reservationSchema = z
  .object({
    person_id: z.number().int().positive(),
    car_id: z.number().int().positive(),
    start_date: z.string().min(10),
    end_date: z.string().min(10),
    // Optional reservation times (#191). Both null = all-day. When set, start_time
    // is the time on start_date and end_time the time on end_date (may span days).
    start_time: timeField,
    end_time: timeField,
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
  })
  // Times come as a pair, or not at all.
  .refine((v) => (v.start_time === null) === (v.end_time === null), {
    message: "start_time and end_time must both be set or both omitted",
    path: ["end_time"],
  })
  // On a single-day timed reservation, end_time must be after start_time. For a
  // multi-day timed reservation the end_time is on a later date, so any order is fine.
  .refine(
    (v) =>
      v.start_time === null ||
      v.end_time === null ||
      v.start_date !== v.end_date ||
      v.end_time > v.start_time,
    {
      message: "end_time must be after start_time on a single-day reservation",
      path: ["end_time"],
    }
  );

export const reservationStatusSchema = z.object({
  status: z.enum(["pending", "confirmed", "rejected"]),
});
