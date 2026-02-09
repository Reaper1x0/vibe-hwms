import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
});

const rawEnv = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

export type Env = z.infer<typeof envSchema>;

export function isSupabaseConfigured() {
  return Boolean(rawEnv.NEXT_PUBLIC_SUPABASE_URL && rawEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function getEnv(): Env {
  return envSchema.parse(rawEnv);
}
