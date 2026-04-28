import { z } from "zod";

const envSchema = z.object({
  SESSION_PASSWORD: z.string().min(1, "SESSION_PASSWORD is required"),
  DB_PATH: z
    .string()
    .optional()
    .transform((val) => val ?? "data/autodelen.db"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  NEXT_PUBLIC_BASE_URL: z.string().url().optional(),
  AUTH_USERNAME: z.string().optional(),
  AUTH_PASSWORD_HASH: z.string().optional(),
});

export const env = envSchema.parse(process.env);
