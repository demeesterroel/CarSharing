import { z } from "zod";

export const personSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().default(""),
  name: z.string().optional(), // kept for backward compat; computed from first_name + last_name if omitted
  discount: z.number().min(0).max(1).default(0),
  discount_long: z.number().min(0).max(1).default(0),
  active: z.union([z.literal(0), z.literal(1)]).default(1),
  username: z.string().min(1).nullable().optional(),
  is_admin: z.union([z.literal(0), z.literal(1)]).default(0),
  bank_account: z.string().default(""),
  email: z.string().email().nullable().optional(),
});
