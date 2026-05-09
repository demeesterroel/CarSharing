import { z } from "zod";

const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

const envSchema = z.object({
  SESSION_PASSWORD: isBuildPhase
    ? z.string().optional().default("build-placeholder")
    : z.string().min(1, "SESSION_PASSWORD is required"),
  DB_PATH: z
    .string()
    .optional()
    .transform((val) => val ?? "data/carsharing.db"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  NEXT_PUBLIC_BASE_URL: z.string().url().optional(),
  AUTH_USERNAME: z.string().optional(),
  AUTH_PASSWORD_HASH: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
});

type Env = z.infer<typeof envSchema>;
let _env: Env | undefined;

export const env = new Proxy({} as Env, {
  get(_, key: string) {
    if (!_env) _env = envSchema.parse(process.env);
    return _env[key as keyof Env];
  },
});
