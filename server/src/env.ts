import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

// Works both from `server/src` (tsx) and `server/dist` (compiled output).
const moduleDir = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(moduleDir, '../.env') });
loadEnv();

const optionalString = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().optional(),
);

const booleanString = z
  .enum(['true', 'false', '1', '0'])
  .optional()
  .transform((value) => value === 'true' || value === '1');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required.'),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173,http://127.0.0.1:5173')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  COOKIE_SECURE: booleanString,
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  PUBLIC_API_URL: z.string().trim().default('http://localhost:3001'),
  UPLOAD_DIR: z.string().trim().default('./uploads'),
  MAX_UPLOAD_BYTES: z.coerce.number().int().min(1024).default(10 * 1024 * 1024),
  S3_ENDPOINT: optionalString,
  S3_REGION: optionalString,
  S3_BUCKET: optionalString,
  S3_ACCESS_KEY: optionalString,
  S3_SECRET_KEY: optionalString,
  S3_PUBLIC_URL: optionalString,
  S3_FORCE_PATH_STYLE: z
    .enum(['true', 'false', '1', '0'])
    .default('true')
    .transform((value) => value === 'true' || value === '1'),
  SEED_DEMO_EMAIL: z.string().trim().default('demo@retrokeep.local'),
  SEED_DEMO_PASSWORD: z.string().min(8).default('demo12345'),
  SEED_DEMO_ROLE: z.enum(['user', 'moderator', 'admin']).default('user'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
    .join('\n');
  // Configuration errors must be visible before Fastify starts.
  console.error(`Invalid environment configuration:\n${details}`);
  process.exit(1);
}

const data = parsed.data;
const publicApiUrl = data.PUBLIC_API_URL.replace(/\/+$/, '');
const s3Enabled = Boolean(
  data.S3_ENDPOINT && data.S3_BUCKET && data.S3_ACCESS_KEY && data.S3_SECRET_KEY,
);

export const env = {
  nodeEnv: data.NODE_ENV,
  isProduction: data.NODE_ENV === 'production',
  host: data.HOST,
  port: data.PORT,
  databaseUrl: data.DATABASE_URL,
  corsOrigins: data.CORS_ORIGINS,
  cookieSecure: data.COOKIE_SECURE || data.NODE_ENV === 'production',
  sessionTtlDays: data.SESSION_TTL_DAYS,
  publicApiUrl,
  uploadDir: path.resolve(process.cwd(), data.UPLOAD_DIR),
  maxUploadBytes: data.MAX_UPLOAD_BYTES,
  s3: {
    enabled: s3Enabled,
    endpoint: data.S3_ENDPOINT ?? '',
    region: data.S3_REGION ?? 'us-east-1',
    bucket: data.S3_BUCKET ?? '',
    accessKey: data.S3_ACCESS_KEY ?? '',
    secretKey: data.S3_SECRET_KEY ?? '',
    publicUrl: (data.S3_PUBLIC_URL ?? '').replace(/\/+$/, ''),
    forcePathStyle: data.S3_FORCE_PATH_STYLE,
  },
  seedDemoEmail: data.SEED_DEMO_EMAIL,
  seedDemoPassword: data.SEED_DEMO_PASSWORD,
  seedDemoRole: data.SEED_DEMO_ROLE,
} as const;
