import { z } from 'zod';

const envSchema = z.object({
  VITE_API_URL:  z.string().url().default('http://localhost:8000'),
  VITE_APP_NAME: z.string().default('Brainwave'),
});

const parsed = envSchema.safeParse(import.meta.env);
if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.format());
}

export const env = parsed.success ? parsed.data : envSchema.parse({});
